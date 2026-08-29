import { Chunk } from './chunk';
import {
	chunkKey,
	coordForResidue,
	mod,
	windowBounds,
} from './chunkUtils';

export type ChunkGenerator = (
	cx: number,
	cz: number,
	pixels: number,
) => Promise<Chunk>;

const DEFAULT_CACHE_CAPACITY = 32;

interface SlotState {
	chunk: Chunk;
	ready: boolean;
	/** World chunk coord this slot is generating or displaying. */
	targetCx: number;
	targetCz: number;
}

/**
 * Owns a fixed N×N atlas of chunks keyed by (cx mod N, cz mod N).
 * Streams world chunks in/out as the player moves; generation is async
 * via an injected ChunkGenerator (worker / WASM / deferred main thread).
 */
export class ChunkManager {
	private readonly numChunks: number;
	private readonly numPixels: number;
	private readonly slots: SlotState[];
	private readonly cache = new Map<string, Chunk>();
	private readonly cacheCapacity: number;
	private readonly generate: ChunkGenerator;

	private centerCx = NaN;
	private centerCz = NaN;
	private readonly pendingReady: { slotX: number; slotZ: number }[] = [];

	constructor(
		dim: number,
		pixels: number,
		generator: ChunkGenerator,
		cacheCapacity = DEFAULT_CACHE_CAPACITY,
	) {
		this.numChunks = dim;
		this.numPixels = pixels;
		this.generate = generator;
		this.cacheCapacity = cacheCapacity;
		this.slots = new Array(dim * dim);

		for (let i = 0; i < dim * dim; i++) {
			this.slots[i] = {
				chunk: new Chunk(0, 0, pixels),
				ready: false,
				targetCx: NaN,
				targetCz: NaN,
			};
		}
	}

	getNumChunks(): number {
		return this.numChunks;
	}

	getNumPixels(): number {
		return this.numPixels;
	}

	getCenterChunk(): { cx: number; cz: number } {
		return { cx: this.centerCx, cz: this.centerCz };
	}

	/**
	 * Call when the player's center chunk changes (chunk-boundary crossing).
	 * Diffs the old N×N window against the new one and kicks off generation
	 * only for atlas slots whose correct occupant changed.
	 */
	onPlayerMove(newCenterCx: number, newCenterCz: number): void {
		if (
			!Number.isNaN(this.centerCx) &&
			newCenterCx === this.centerCx &&
			newCenterCz === this.centerCz
		) {
			return;
		}
		this.centerCx = newCenterCx;
		this.centerCz = newCenterCz;
		this.syncWindow();
	}

	/** Slots that became ready since the last consumeReadySlots() call. */
	consumeReadySlots(): readonly { slotX: number; slotZ: number }[] {
		const ready = this.pendingReady.slice();
		this.pendingReady.length = 0;
		return ready;
	}

	isSlotReady(slotX: number, slotZ: number): boolean {
		return this.slotAt(slotX, slotZ).ready;
	}

	/** Heightmap for an atlas slot (slotX, slotZ), not a world chunk coord. */
	getChunkData(slotX: number, slotZ: number): Float32Array {
		return this.slotAt(slotX, slotZ).chunk.getHeightMap();
	}

	getMinY(slotX: number, slotZ: number): number {
		return this.slotAt(slotX, slotZ).chunk.getMinY() / this.numPixels;
	}

	getBBHeight(slotX: number, slotZ: number): number {
		const chunk = this.slotAt(slotX, slotZ).chunk;
		return chunk.getMaxY() - chunk.getMinY() + 1;
	}

	/** World chunk coord currently bound to an atlas slot, if any. */
	getWorldCoord(
		slotX: number,
		slotZ: number,
	): { cx: number; cz: number } | null {
		const slot = this.slotAt(slotX, slotZ);
		if (!slot.ready) {
			return null;
		}
		return { cx: slot.targetCx, cz: slot.targetCz };
	}

	/** Atlas slot (slotX, slotZ) for a world chunk coord. */
	worldToSlot(cx: number, cz: number): { slotX: number; slotZ: number } {
		return {
			slotX: mod(cx, this.numChunks),
			slotZ: mod(cz, this.numChunks),
		};
	}

	private slotAt(slotX: number, slotZ: number): SlotState {
		return this.slots[slotZ * this.numChunks + slotX];
	}

	private syncWindow(): void {
		const { minCx, minCz } = windowBounds(
			this.centerCx,
			this.centerCz,
			this.numChunks,
		);

		for (let slotZ = 0; slotZ < this.numChunks; slotZ++) {
			for (let slotX = 0; slotX < this.numChunks; slotX++) {
				const targetCx = coordForResidue(minCx, slotX, this.numChunks);
				const targetCz = coordForResidue(minCz, slotZ, this.numChunks);
				const slot = this.slotAt(slotX, slotZ);

				if (
					slot.ready &&
					slot.targetCx === targetCx &&
					slot.targetCz === targetCz
				) {
					continue;
				}

				if (
					!slot.ready &&
					slot.targetCx === targetCx &&
					slot.targetCz === targetCz
				) {
					continue;
				}

				this.loadSlot(slotX, slotZ, targetCx, targetCz);
			}
		}
	}

	private loadSlot(
		slotX: number,
		slotZ: number,
		targetCx: number,
		targetCz: number,
	): void {
		const slot = this.slotAt(slotX, slotZ);

		if (slot.ready) {
			this.evictToCache(slot.targetCx, slot.targetCz, slot.chunk);
		}

		slot.ready = false;
		slot.targetCx = targetCx;
		slot.targetCz = targetCz;

		const key = chunkKey(targetCx, targetCz);
		const cached = this.cache.get(key);
		if (cached) {
			this.cache.delete(key);
			this.applyChunk(slotX, slotZ, cached, targetCx, targetCz);
			return;
		}

		void this.generate(targetCx, targetCz, this.numPixels).then(
			(chunk) => {
				// Worker responses are async and may arrive out of order after
				// later onPlayerMove calls; never write without re-checking the
				// slot's current target coord.
				if (!this.slotStillExpects(slotX, slotZ, targetCx, targetCz)) {
					return;
				}
				this.applyChunk(slotX, slotZ, chunk, targetCx, targetCz);
			},
			(err) => {
				console.error(
					`Chunk generation failed for (${targetCx}, ${targetCz}):`,
					err,
				);
			},
		);
	}

	private slotStillExpects(
		slotX: number,
		slotZ: number,
		targetCx: number,
		targetCz: number,
	): boolean {
		const slot = this.slotAt(slotX, slotZ);
		return slot.targetCx === targetCx && slot.targetCz === targetCz;
	}

	private applyChunk(
		slotX: number,
		slotZ: number,
		chunk: Chunk,
		targetCx: number,
		targetCz: number,
	): void {
		const slot = this.slotAt(slotX, slotZ);
		slot.chunk = chunk;
		slot.targetCx = targetCx;
		slot.targetCz = targetCz;
		slot.ready = true;
		this.pendingReady.push({ slotX, slotZ });
	}

	private evictToCache(cx: number, cz: number, chunk: Chunk): void {
		const key = chunkKey(cx, cz);
		if (this.cache.has(key)) {
			return;
		}
		while (this.cache.size >= this.cacheCapacity) {
			const oldest = this.cache.keys().next().value;
			if (oldest === undefined) {
				break;
			}
			this.cache.delete(oldest);
		}
		this.cache.set(key, chunk);
	}
}

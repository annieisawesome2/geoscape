import { Chunk } from './chunk';
import type { ChunkGenerator } from './chunkManager';
import type { WorkerOutMessage } from './chunkWorkerProtocol';

export function createChunkAt(
	cx: number,
	cz: number,
	pixels: number,
): Chunk {
	return new Chunk(cx * pixels, cz * pixels, pixels);
}

/** Runs chunk generation on a dedicated Web Worker with transferable heightmaps. */
export class WorkerChunkGenerator {
	private readonly worker: Worker;
	private readonly pending = new Map<
		number,
		{
			resolve: (chunk: Chunk) => void;
			reject: (err: Error) => void;
		}
	>();
	private nextId = 0;

	constructor() {
		this.worker = new Worker(
			new URL('./chunk.worker.ts', import.meta.url),
			{ type: 'module' },
		);
		this.worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
			this.onWorkerMessage(event.data);
		};
	}

	readonly generate: ChunkGenerator = (cx, cz, pixels) =>
		new Promise((resolve, reject) => {
			const id = this.nextId++;
			this.pending.set(id, { resolve, reject });
			this.worker.postMessage({
				type: 'generate',
				id,
				cx,
				cz,
				pixels,
			});
		});

	terminate(): void {
		this.worker.terminate();
		for (const { reject } of this.pending.values()) {
			reject(new Error('Worker terminated'));
		}
		this.pending.clear();
	}

	private onWorkerMessage(msg: WorkerOutMessage): void {
		const entry = this.pending.get(msg.id);
		if (!entry) {
			return;
		}
		this.pending.delete(msg.id);

		if (msg.type === 'error') {
			entry.reject(new Error(msg.message));
			return;
		}

		const chunk = createChunkAt(msg.cx, msg.cz, msg.pixels);
		chunk.adoptHeightMap(msg.heightMap, msg.minY, msg.maxY);
		entry.resolve(chunk);
	}
}

export function createWorkerChunkGenerator(): ChunkGenerator {
	return new WorkerChunkGenerator().generate;
}

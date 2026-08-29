import { Chunk } from './chunk';
import { GivenGenerator } from './given_generator';

/** Owns a square grid of chunks and serves height / AABB queries for rendering. */
export class ChunkManager {
	private readonly numChunks: number;
	private readonly numPixels: number;
	private readonly chunks: Chunk[];

	constructor(dim: number, pixels: number) {
		const generator = new GivenGenerator();
		this.numChunks = dim;
		this.numPixels = pixels;
		this.chunks = new Array(dim * dim);

		for (let i = 0; i < dim * dim; i++) {
			const x = (i % dim) * pixels;
			const z = Math.floor(i / dim) * pixels;
			const chunk = new Chunk(x, z, pixels);
			generator.generateHeightMapForChunk(chunk);
			this.chunks[i] = chunk;
		}
	}

	private chunkAt(chunkX: number, chunkZ: number): Chunk {
		return this.chunks[chunkZ * this.numChunks + chunkX];
	}

	getChunkData(chunkX: number, chunkZ: number): Float32Array {
		return this.chunkAt(chunkX, chunkZ).getHeightMap();
	}

	getMinY(chunkX: number, chunkZ: number): number {
		return this.chunkAt(chunkX, chunkZ).getMinY() / this.numPixels;
	}

	getBBHeight(chunkX: number, chunkZ: number): number {
		const chunk = this.chunkAt(chunkX, chunkZ);
		return chunk.getMaxY() - chunk.getMinY() + 1;
	}
}

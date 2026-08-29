import { Chunk } from './chunk';
import { generateHeightMap } from './terrainGen';

/** CPU Perlin / FBM heightmap generator for synchronous / main-thread use. */
export class GivenGenerator {
	generateHeightMapForChunk(chunk: Chunk): void {
		const pixels = chunk.getLength();
		const cx = chunk.getMinX() / pixels;
		const cz = chunk.getMinZ() / pixels;
		const { heightMap, minY, maxY } = generateHeightMap(cx, cz, pixels);
		chunk.adoptHeightMap(heightMap, minY, maxY);
	}
}

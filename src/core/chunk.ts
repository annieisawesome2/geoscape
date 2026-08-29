/**
 * A column of terrain: an N×N heightmap with world-space XZ bounds
 * and a Y range used for the GPU bounding box.
 */
export class Chunk {
	private length: number;
	private heightMap: Float32Array;
	private minX: number;
	private maxX: number;
	private minZ: number;
	private maxZ: number;
	private minY: number;
	private maxY: number;

	constructor(minX: number, minZ: number, length: number) {
		this.minX = minX;
		this.maxX = minX + length - 1;
		this.minZ = minZ;
		this.maxZ = minZ + length - 1;
		this.length = length;
		this.heightMap = new Float32Array(length * length);
		this.minY = Infinity;
		this.maxY = 0;
	}

	getLength(): number {
		return this.length;
	}

	getHeightMap(): Float32Array {
		return this.heightMap;
	}

	getHeightAt(x: number, z: number): number {
		return this.heightMap[(z - this.minZ) * this.length + (x - this.minX)];
	}

	setHeightAt(x: number, z: number, height: number): void {
		this.heightMap[(z - this.minZ) * this.length + (x - this.minX)] = height;
	}

	getMinX(): number {
		return this.minX;
	}

	getMaxX(): number {
		return this.maxX;
	}

	getMinZ(): number {
		return this.minZ;
	}

	getMaxZ(): number {
		return this.maxZ;
	}

	getMinY(): number {
		return this.minY;
	}

	setMinY(y: number): void {
		this.minY = y;
	}

	getMaxY(): number {
		return this.maxY;
	}

	setMaxY(y: number): void {
		this.maxY = y;
	}
}

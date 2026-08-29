/** Larger = peaks farther apart */
export const NOISE_SCALE = 16;
/** Larger = more contrast (taller peaks / deeper valleys) */
export const HEIGHT_POW = 2;
/** Upper bound on heightmap values: fbm ∈ [0, 1], then raised to HEIGHT_POW. */
export const MAX_TERRAIN_HEIGHT = 1.0;

export interface HeightMapResult {
	heightMap: Float32Array;
	minY: number;
	maxY: number;
}

function quintic(t: number): number {
	return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

function hash2(x: number, y: number): [number, number] {
	const dot1 = x * 127.1 + y * 311.7;
	const dot2 = x * 269.5 + y * 183.3;
	const hash1 = Math.sin(dot1) * 43758.5453123;
	const hash2 = Math.sin(dot2) * 43758.5453123;
	return [
		-1.0 + 2.0 * (hash1 - Math.floor(hash1)),
		-1.0 + 2.0 * (hash2 - Math.floor(hash2)),
	];
}

function perlinNoise(px: number, py: number): number {
	const piX = Math.floor(px);
	const piY = Math.floor(py);
	const pfX = px - piX;
	const pfY = py - piY;

	const [g00x, g00y] = hash2(piX, piY);
	const [g10x, g10y] = hash2(piX + 1.0, piY);
	const [g01x, g01y] = hash2(piX, piY + 1.0);
	const [g11x, g11y] = hash2(piX + 1.0, piY + 1.0);

	const len00 = Math.hypot(g00x, g00y) || 1;
	const len10 = Math.hypot(g10x, g10y) || 1;
	const len01 = Math.hypot(g01x, g01y) || 1;
	const len11 = Math.hypot(g11x, g11y) || 1;

	const n00 = (g00x * pfX + g00y * pfY) / len00;
	const n10 = (g10x * (pfX - 1.0) + g10y * pfY) / len10;
	const n01 = (g01x * pfX + g01y * (pfY - 1.0)) / len01;
	const n11 = (g11x * (pfX - 1.0) + g11y * (pfY - 1.0)) / len11;

	const u = quintic(pfX);
	const v = quintic(pfY);
	const nx0 = n00 + (n10 - n00) * u;
	const nx1 = n01 + (n11 - n01) * u;
	return (nx0 + (nx1 - nx0) * v) * 0.5 + 0.5;
}

function fbm(x: number, y: number): number {
	let value = 0.0;
	let amplitude = 1.6;
	let freq = 1.0;

	for (let i = 0; i < 2
        ; i++) {
		value += perlinNoise(x * freq, y * freq) * amplitude;
		amplitude *= 0.4;
		freq *= 2.0;
	}

	return value;
}

function terrainHeightMap(x: number, z: number): number {
	return fbm(x * 0.5, z * 0.5);
}

/** CPU heightmap for one chunk; safe to run on a Web Worker thread. */
export function generateHeightMap(
	cx: number,
	cz: number,
	pixels: number,
): HeightMapResult {
	const minX = cx * pixels;
	const minZ = cz * pixels;
	const heightMap = new Float32Array(pixels * pixels);
	let minY = Infinity;
	let maxY = 0;

	for (let z = minZ; z < minZ + pixels; z++) {
		for (let x = minX; x < minX + pixels; x++) {
			const height =
				terrainHeightMap(x / NOISE_SCALE, z / NOISE_SCALE) ** HEIGHT_POW;
			const localX = x - minX;
			const localZ = z - minZ;
			heightMap[localZ * pixels + localX] = height;

			if (height < minY) {
				minY = height;
			}
			if (height > maxY) {
				maxY = height;
			}
		}
	}

	return { heightMap, minY, maxY };
}

import * as THREE from 'three';
import { Chunk } from './chunk';

/** Larger = peaks farther apart */
const NOISE_SCALE = 16;
/** Larger = more contrast (taller peaks / deeper valleys) */
const HEIGHT_POW = 2;

/** CPU Perlin / FBM heightmap generator used at chunk creation time. */
export class GivenGenerator {
	/** Quintic fade (C2). See Scratchapixel improved Perlin notes. */
	private quinticInterpolation(t: THREE.Vector2): THREE.Vector2 {
		const x = t.x * t.x * t.x * (t.x * (t.x * 6.0 - 15.0) + 10.0);
		const y = t.y * t.y * t.y * (t.y * (t.y * 6.0 - 15.0) + 10.0);
		return new THREE.Vector2(x, y);
	}

	private hash2(p: THREE.Vector2): THREE.Vector2 {
		const dot1 = p.x * 127.1 + p.y * 311.7;
		const dot2 = p.x * 269.5 + p.y * 183.3;
		const hash1 = Math.sin(dot1) * 43758.5453123;
		const hash2 = Math.sin(dot2) * 43758.5453123;
		return new THREE.Vector2(
			-1.0 + 2.0 * (hash1 - Math.floor(hash1)),
			-1.0 + 2.0 * (hash2 - Math.floor(hash2)),
		);
	}

	perlinNoise(P: THREE.Vector2): number {
		const Pi = new THREE.Vector2(Math.floor(P.x), Math.floor(P.y));
		const Pf = new THREE.Vector2(P.x - Pi.x, P.y - Pi.y);

		const g00 = this.hash2(new THREE.Vector2(Pi.x, Pi.y)).normalize();
		const g10 = this.hash2(new THREE.Vector2(Pi.x + 1.0, Pi.y)).normalize();
		const g01 = this.hash2(new THREE.Vector2(Pi.x, Pi.y + 1.0)).normalize();
		const g11 = this.hash2(new THREE.Vector2(Pi.x + 1.0, Pi.y + 1.0)).normalize();

		const n00 = g00.dot(new THREE.Vector2(Pf.x, Pf.y));
		const n10 = g10.dot(new THREE.Vector2(Pf.x - 1.0, Pf.y));
		const n01 = g01.dot(new THREE.Vector2(Pf.x, Pf.y - 1.0));
		const n11 = g11.dot(new THREE.Vector2(Pf.x - 1.0, Pf.y - 1.0));

		const u = this.quinticInterpolation(Pf);
		const nx0 = n00 + (n10 - n00) * u.x;
		const nx1 = n01 + (n11 - n01) * u.x;
		return (nx0 + (nx1 - nx0) * u.y) * 0.5 + 0.5;
	}

	fbm(uv: THREE.Vector2): number {
		let value = 0.0;
		let amplitude = 1.6;
		let freq = 1.0;

		for (let i = 0; i < 8; i++) {
			value += this.perlinNoise(new THREE.Vector2(uv.x * freq, uv.y * freq)) * amplitude;
			amplitude *= 0.4;
			freq *= 2.0;
		}

		return value;
	}

	terrainHeightMap(pos: THREE.Vector3): number {
		return this.fbm(new THREE.Vector2(pos.x * 0.5, pos.z * 0.5));
	}

	generateHeightMapForChunk(chunk: Chunk): void {
		const minX = chunk.getMinX();
		const minZ = chunk.getMinZ();
		const length = chunk.getLength();
		let minY = chunk.getMinY();
		let maxY = chunk.getMaxY();

		for (let z = minZ; z < minZ + length; z++) {
			for (let x = minX; x < minX + length; x++) {
				const worldPos = new THREE.Vector3(x / NOISE_SCALE, 0, z / NOISE_SCALE);
				const height = this.terrainHeightMap(worldPos) ** HEIGHT_POW;
				chunk.setHeightAt(x, z, height);

				if (height < minY) {
					chunk.setMinY(height);
					minY = height;
				}
				if (height > maxY) {
					chunk.setMaxY(height);
					maxY = height;
				}
			}
		}
	}
}

/**
 * Experimental CPU SDF / FBM terrain generator (not wired into the render path).
 * Active generation uses GivenGenerator instead.
 */
import * as THREE from 'three';

export class Generator {
	private smin(a: number, b: number, k: number): number {
		const h = Math.max(k - Math.abs(a - b), 0.0);
		return Math.min(a, b) - (h * h * 0.25) / k;
	}

	private smax(a: number, b: number, k: number): number {
		const h = Math.max(k - Math.abs(a - b), 0.0);
		return Math.max(a, b) + (h * h * 0.25) / k;
	}

	private fractVec3(v: THREE.Vector3): THREE.Vector3 {
		const floored = new THREE.Vector3().copy(v).floor();
		return new THREE.Vector3().subVectors(v, floored);
	}

	private fractFloat(f: number): number {
		return f - Math.floor(f);
	}

	/** Distance from point to a hashed-radius sphere at grid vertex origin+offset. */
	private sph(origin: THREE.Vector3, point: THREE.Vector3, offset: THREE.Vector3): number {
		const p = this.fractVec3(
			new THREE.Vector3()
				.addVectors(origin, offset)
				.multiplyScalar(0.3183099)
				.add(new THREE.Vector3(0.11, 0.17, 0.13)),
		).multiplyScalar(17.0);
		const w = this.fractFloat(p.x * p.y * p.z * (p.x + p.y + p.z));
		const r = 0.7 * w * w;
		return new THREE.Vector3().subVectors(point, offset).length() - r;
	}

	private sdBase(p: THREE.Vector3): number {
		const origin = new THREE.Vector3().copy(p).floor();
		const fraction = this.fractVec3(p);
		return Math.min(
			Math.min(
				Math.min(
					this.sph(origin, fraction, new THREE.Vector3(0, 0, 0)),
					this.sph(origin, fraction, new THREE.Vector3(0, 0, 1)),
				),
				Math.min(
					this.sph(origin, fraction, new THREE.Vector3(0, 1, 0)),
					this.sph(origin, fraction, new THREE.Vector3(0, 1, 1)),
				),
			),
			Math.min(
				Math.min(
					this.sph(origin, fraction, new THREE.Vector3(1, 0, 0)),
					this.sph(origin, fraction, new THREE.Vector3(1, 0, 1)),
				),
				Math.min(
					this.sph(origin, fraction, new THREE.Vector3(1, 1, 0)),
					this.sph(origin, fraction, new THREE.Vector3(1, 1, 1)),
				),
			),
		);
	}

	/** Returns (distance, accumulated distortion) for experimental terrain sampling. */
	sample(p: THREE.Vector3, th: number, minDist: number): THREE.Vector2 {
		return this.sdFbm(p, th, minDist);
	}

	private sdFbm(p: THREE.Vector3, th: number, minDist: number): THREE.Vector2 {
		const transformationMatrix = new THREE.Matrix3(
			0.0, 1.6, 1.2,
			-1.6, 0.72, -0.96,
			-1.2, -0.96, 1.28,
		);
		const transformedPoint = new THREE.Vector3().copy(p);
		let accumedDistortion = 0.0;
		let scale = 1.0;
		const ioct = 11;

		for (let i = 0; i < ioct; i++) {
			if (minDist > scale * 0.866) break;
			if (scale < th) break;

			let newDist = scale * this.sdBase(transformedPoint);
			newDist = this.smax(newDist, minDist - 0.1 * scale, 0.3 * scale);
			minDist = this.smin(newDist, minDist, 0.3 * scale);
			transformedPoint.applyMatrix3(transformationMatrix);
			scale *= 0.415;

			accumedDistortion += minDist;
			transformedPoint.z += -4.33 * accumedDistortion * scale;
		}

		return new THREE.Vector2(minDist, accumedDistortion);
	}
}

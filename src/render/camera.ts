import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Center of the 5×5 chunk grid in world units */
const TERRAIN_CENTER = new THREE.Vector3(2.5, 0.5, 2.5);

export class OrbitCamera {
	readonly inner: THREE.PerspectiveCamera;
	readonly controls: OrbitControls;

	constructor(canvas: HTMLCanvasElement) {
		this.inner = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			2000,
		);
		this.inner.position.set(2.5, 8, 10);

		this.controls = new OrbitControls(this.inner, canvas);
		this.controls.target.copy(TERRAIN_CENTER);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.rotateSpeed = 0.7;
		this.controls.panSpeed = 0.8;
		this.controls.minDistance = 2;
		this.controls.maxDistance = 40;
		this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
		this.controls.update();

		window.addEventListener('resize', () => {
			this.inner.aspect = window.innerWidth / window.innerHeight;
			this.inner.updateProjectionMatrix();
		});
	}

	tick(): void {
		this.controls.update();
	}
}

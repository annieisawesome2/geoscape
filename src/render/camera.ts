import type { Input } from '../input';
import * as THREE from 'three';

const UP_VEC = new THREE.Vector3(0.0, 1.0, 0.0);
const ROT_SPEED = 0.1;
const MOVE_SPEED = 5.0;

export class MovableCamera {
	readonly inner: THREE.PerspectiveCamera;
	#dir = new THREE.Vector3();
	#dirR = new THREE.Vector3();
	#input: Input;
	#lastDt = 0;

	constructor(input: Input) {
		this.inner = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			2000,
		);
		this.inner.getWorldDirection(this.#dir);
		this.inner.position.set(2, 0, 10);
		this.#input = input;

		window.addEventListener('resize', () => {
			this.inner.aspect = window.innerWidth / window.innerHeight;
			this.inner.updateProjectionMatrix();
		});
	}

	#move(v: THREE.Vector3, scale: number): void {
		this.inner.position.addScaledVector(v, MOVE_SPEED * scale);
	}

	#updateView(): void {
		this.inner.updateMatrix();
		this.inner.getWorldDirection(this.#dir);
		this.#dirR.copy(UP_VEC).cross(this.#dir);
	}

	/** Separate from the key map to reduce look stutter. */
	tickMouse(evt: PointerEvent): void {
		this.inner.rotateY(evt.movementX * ROT_SPEED * this.#lastDt);
		this.inner.rotateX(evt.movementY * ROT_SPEED * this.#lastDt);
		// TODO: lock roll so we only pitch/yaw
	}

	tick(dt: number): void {
		this.#lastDt = dt;
		if (this.#input.isPressed('KeyW')) this.#move(this.#dir, dt);
		if (this.#input.isPressed('KeyS')) this.#move(this.#dir, -dt);
		if (this.#input.isPressed('KeyA')) this.#move(this.#dirR, dt);
		if (this.#input.isPressed('KeyD')) this.#move(this.#dirR, -dt);
		if (this.#input.isPressed('KeyE')) this.#move(UP_VEC, dt);
		if (this.#input.isPressed('KeyQ')) this.#move(UP_VEC, -dt);
		this.#updateView();
	}
}

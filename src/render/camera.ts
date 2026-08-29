import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	INITIAL_WORLD_X,
	INITIAL_WORLD_Z,
} from '../config';
import { MAX_TERRAIN_HEIGHT } from '../core/terrainGen';

/** World units per second along X / Z when holding a movement key */
const MOVE_SPEED = 3;
/** Buffer above tallest possible peak so the eye never clips terrain */
const HOVER_CLEARANCE = 5;
/** Small horizontal offset so OrbitControls has a non-zero orbit radius */
const ORBIT_OFFSET = 5;
const EYE_Y = MAX_TERRAIN_HEIGHT + HOVER_CLEARANCE;

export class OrbitCamera {
	readonly inner: THREE.PerspectiveCamera;
	readonly controls: OrbitControls;

	private readonly clock = new THREE.Clock();
	private readonly keys = new Set<string>();
	private readonly moveDelta = new THREE.Vector3();

	constructor(canvas: HTMLCanvasElement) {
		this.inner = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			2000,
		);
		this.inner.position.set(
			INITIAL_WORLD_X,
			EYE_Y,
			INITIAL_WORLD_Z + ORBIT_OFFSET,
		);

		this.controls = new OrbitControls(this.inner, canvas);
		this.controls.target.set(INITIAL_WORLD_X, MAX_TERRAIN_HEIGHT, INITIAL_WORLD_Z);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.rotateSpeed = 0.7;
		this.controls.panSpeed = 0.8;
		this.controls.screenSpacePanning = true;
		this.controls.minDistance = 0.4;
		this.controls.maxDistance = 12;
		this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
		this.controls.update();

		window.addEventListener('keydown', (e) => this.onKeyChange(e, true));
		window.addEventListener('keyup', (e) => this.onKeyChange(e, false));
		window.addEventListener('blur', () => this.keys.clear());
		window.addEventListener('resize', () => {
			this.inner.aspect = window.innerWidth / window.innerHeight;
			this.inner.updateProjectionMatrix();
		});
	}

	/** Chunk coord under the orbit target; drives terrain streaming. */
	getCenterChunk(): { cx: number; cz: number } {
		return {
			cx: Math.floor(this.controls.target.x),
			cz: Math.floor(this.controls.target.z),
		};
	}

	tick(): void {
		this.applyWorldAxisMovement(this.clock.getDelta());
		this.controls.update();
	}

	private onKeyChange(event: KeyboardEvent, pressed: boolean): void {
		const key = event.key.toLowerCase();
		if (!this.isMovementKey(key)) {
			return;
		}
		event.preventDefault();
		if (pressed) {
			this.keys.add(key);
		} else {
			this.keys.delete(key);
		}
	}

	private isMovementKey(key: string): boolean {
		return (
			key === 'w' ||
			key === 'a' ||
			key === 's' ||
			key === 'd' ||
			key === 'arrowup' ||
			key === 'arrowdown' ||
			key === 'arrowleft' ||
			key === 'arrowright'
		);
	}

	/** Translate camera + target together along world X / Z. */
	private applyWorldAxisMovement(dt: number): void {
		if (this.keys.size === 0) {
			return;
		}

		let dx = 0;
		let dz = 0;
		if (this.keys.has('w') || this.keys.has('arrowup')) {
			dz -= 1;
		}
		if (this.keys.has('s') || this.keys.has('arrowdown')) {
			dz += 1;
		}
		if (this.keys.has('a') || this.keys.has('arrowleft')) {
			dx -= 1;
		}
		if (this.keys.has('d') || this.keys.has('arrowright')) {
			dx += 1;
		}

		const len = Math.hypot(dx, dz);
		if (len === 0) {
			return;
		}

		this.moveDelta.set((dx / len) * MOVE_SPEED * dt, 0, (dz / len) * MOVE_SPEED * dt);
		this.inner.position.add(this.moveDelta);
		this.controls.target.add(this.moveDelta);
	}
}

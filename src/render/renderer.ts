import * as THREE from 'three';
import { Input } from '../input';
import { ChunkManager } from '../core/chunkManager';
import { MovableCamera } from './camera';
import vertexShader from './vertex.glsl?raw';
import fragmentShader from './fragment.glsl?raw';

/** Side length of the visible x-z grid of chunks */
const VIEW_DIAMETER = 5;
/** Side length of a chunk in heightmap texels */
const CHUNK_SIZE = 32;
const HEIGHTMAP_SIZE = VIEW_DIAMETER * CHUNK_SIZE;
const SKY_COLOR = 0x87cefa;

export class Renderer {
	private readonly webgl = new THREE.WebGLRenderer();
	private readonly clock = new THREE.Clock();
	private readonly scene = new THREE.Scene();
	private readonly input: Input;
	private readonly camera: MovableCamera;

	private readonly chunks = new ChunkManager(VIEW_DIAMETER, CHUNK_SIZE);
	private readonly bbTransforms = new Float32Array(VIEW_DIAMETER ** 2 * 4);
	private readonly heightmapData = new Float32Array(HEIGHTMAP_SIZE ** 2);
	private readonly heightmap: THREE.DataTexture;
	private readonly material: THREE.ShaderMaterial;
	private readonly bbGeom = new THREE.BoxGeometry(1, 1, 1);
	private readonly instance: THREE.InstancedMesh;

	constructor() {
		this.heightmap = this.createHeightmapTexture();
		this.material = new THREE.ShaderMaterial({
			uniforms: {
				scrSize: new THREE.Uniform(new THREE.Vector2()),
				heightmap: { value: this.heightmap },
			},
			vertexShader,
			fragmentShader,
		});
		this.instance = new THREE.InstancedMesh(
			this.bbGeom,
			this.material,
			VIEW_DIAMETER ** 2,
		);

		this.input = new Input(this.webgl.domElement);
		this.camera = new MovableCamera(this.input);
		this.input.registerMouseCb((evt) => this.camera.tickMouse(evt));

		this.setupCanvas();
		this.resize();
		this.setupHeightmap();
		this.setupInstances();

		window.addEventListener('resize', () => this.resize());
		this.webgl.setAnimationLoop(() => this.tick());
	}

	private createHeightmapTexture(): THREE.DataTexture {
		return new THREE.DataTexture(
			this.heightmapData,
			HEIGHTMAP_SIZE,
			HEIGHTMAP_SIZE,
			THREE.RedFormat,
			THREE.FloatType,
		);
	}

	private setupCanvas(): void {
		document.body.appendChild(this.webgl.domElement);
		document.body.style.background = '#87CEFA';
		this.scene.background = new THREE.Color(SKY_COLOR);
		this.webgl.setClearColor(SKY_COLOR, 1);
	}

	private setupHeightmap(): void {
		this.heightmap.minFilter = THREE.NearestFilter;
		this.heightmap.magFilter = THREE.NearestFilter;
		this.heightmap.wrapS = THREE.ClampToEdgeWrapping;
		this.heightmap.wrapT = THREE.ClampToEdgeWrapping;
	}

	private setupInstances(): void {
		// InstancedMesh frustum-culls from the base geometry only, so disable it.
		this.instance.instanceMatrix.setUsage(THREE.StaticDrawUsage);
		this.instance.frustumCulled = false;
		this.scene.add(this.instance);

		for (let i = 0; i < VIEW_DIAMETER * VIEW_DIAMETER; i++) {
			const x = i % VIEW_DIAMETER;
			const z = Math.floor(i / VIEW_DIAMETER);
			this.bbTransforms[i * 4 + 0] = x;
			this.bbTransforms[i * 4 + 1] = this.chunks.getMinY(x, z);
			this.bbTransforms[i * 4 + 2] = z;
			this.bbTransforms[i * 4 + 3] = this.chunks.getBBHeight(x, z);
			this.writeRegion(x, z);
		}

		this.heightmap.needsUpdate = true;

		this.bbGeom.setAttribute(
			'transforms',
			new THREE.InstancedBufferAttribute(this.bbTransforms, 4),
		);
	}

	/** Copy a chunk's height samples into the atlas CPU buffer. */
	private writeRegion(chunkX: number, chunkZ: number): void {
		const src = this.chunks.getChunkData(chunkX, chunkZ);
		const ofsX = chunkX * CHUNK_SIZE;
		const ofsZ = chunkZ * CHUNK_SIZE;

		for (let row = 0; row < CHUNK_SIZE; row++) {
			const srcStart = row * CHUNK_SIZE;
			const dstStart = (ofsZ + row) * HEIGHTMAP_SIZE + ofsX;
			this.heightmapData.set(
				src.subarray(srcStart, srcStart + CHUNK_SIZE),
				dstStart,
			);
		}
	}

	private resize(): void {
		this.webgl.setSize(window.innerWidth, window.innerHeight);
		this.material.uniforms.scrSize.value.set(
			window.innerWidth,
			window.innerHeight,
		);
	}

	private tick(): void {
		const dt = this.clock.getDelta();
		this.camera.tick(dt);
		this.webgl.render(this.scene, this.camera.inner);
	}
}

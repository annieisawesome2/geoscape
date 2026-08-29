import * as THREE from 'three';
import { ChunkManager } from '../core/chunkManager';
import { createWorkerChunkGenerator } from '../core/chunkGenerator';
import { CHUNK_SIZE, HEIGHTMAP_SIZE, INITIAL_CENTER_CX, INITIAL_CENTER_CZ, VIEW_DIAMETER } from '../config';
import { OrbitCamera } from './camera';
import starSkyGlsl from './starSky.glsl?raw';
import vertexShader from './vertex.glsl?raw';
import fragmentShader from './fragment.glsl?raw';
import skyVertexShader from './sky.vert?raw';
import skyFragmentShader from './sky.frag?raw';

const SKY_SHADER = starSkyGlsl;
const SKY_FRAGMENT = SKY_SHADER + skyFragmentShader;
/** Dark night blue — matches starSky.glsl base tone */
const SKY_COLOR = 0x050817;

export class Renderer {
	private readonly webgl = new THREE.WebGLRenderer();
	private readonly scene = new THREE.Scene();
	private readonly camera: OrbitCamera;

	private readonly chunks = new ChunkManager(
		VIEW_DIAMETER,
		CHUNK_SIZE,
		createWorkerChunkGenerator(),
		128,
	);
	private readonly bbTransforms = new Float32Array(VIEW_DIAMETER ** 2 * 4);
	private readonly slotReadyAttr = new Float32Array(VIEW_DIAMETER ** 2);
	private readonly heightmapData = new Float32Array(HEIGHTMAP_SIZE ** 2);
	private readonly heightmap: THREE.DataTexture;
	private readonly material: THREE.ShaderMaterial;
	private readonly bbGeom = new THREE.BoxGeometry(1, 1, 1);
	private readonly instance: THREE.InstancedMesh;
	private readonly sky: THREE.Mesh;

	private lastCenterCx = NaN;
	private lastCenterCz = NaN;

	constructor() {
		this.heightmap = this.createHeightmapTexture();
		this.material = new THREE.ShaderMaterial({
			uniforms: {
				scrSize: new THREE.Uniform(new THREE.Vector2()),
				heightmap: { value: this.heightmap },
				viewDiameter: { value: VIEW_DIAMETER },
			},
			vertexShader,
			fragmentShader,
		});
		this.instance = new THREE.InstancedMesh(
			this.bbGeom,
			this.material,
			VIEW_DIAMETER ** 2,
		);

		this.setupCanvas();
		this.sky = this.createSky();
		this.camera = new OrbitCamera(this.webgl.domElement);
		this.resize();
		this.setupHeightmap();
		this.setupInstances();
		this.chunks.onPlayerMove(INITIAL_CENTER_CX, INITIAL_CENTER_CZ);

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
		document.body.style.background = '#050817';
		this.scene.background = new THREE.Color(SKY_COLOR);
		this.webgl.setClearColor(SKY_COLOR, 1);
	}

	private createSky(): THREE.Mesh {
		const sky = new THREE.Mesh(
			new THREE.SphereGeometry(500, 32, 16),
			new THREE.ShaderMaterial({
				vertexShader: skyVertexShader,
				fragmentShader: SKY_FRAGMENT,
				side: THREE.BackSide,
				depthWrite: false,
				depthTest: false,
			}),
		);
		sky.renderOrder = -1;
		this.scene.add(sky);
		return sky;
	}

	private setupHeightmap(): void {
		this.heightmap.minFilter = THREE.NearestFilter;
		this.heightmap.magFilter = THREE.NearestFilter;
		this.heightmap.wrapS = THREE.ClampToEdgeWrapping;
		this.heightmap.wrapT = THREE.ClampToEdgeWrapping;
	}

	private setupInstances(): void {
		this.instance.instanceMatrix.setUsage(THREE.StaticDrawUsage);
		this.instance.frustumCulled = false;
		this.scene.add(this.instance);

		for (let slotIdx = 0; slotIdx < VIEW_DIAMETER * VIEW_DIAMETER; slotIdx++) {
			const slotX = slotIdx % VIEW_DIAMETER;
			const slotZ = Math.floor(slotIdx / VIEW_DIAMETER);
			this.bbTransforms[slotIdx * 4 + 0] = slotX;
			this.bbTransforms[slotIdx * 4 + 1] = 0;
			this.bbTransforms[slotIdx * 4 + 2] = slotZ;
			this.bbTransforms[slotIdx * 4 + 3] = 1;
			this.slotReadyAttr[slotIdx] = 0;
			void slotX;
			void slotZ;
		}

		this.bbGeom.setAttribute(
			'transforms',
			new THREE.InstancedBufferAttribute(this.bbTransforms, 4),
		);
		this.bbGeom.setAttribute(
			'slotReady',
			new THREE.InstancedBufferAttribute(this.slotReadyAttr, 1),
		);
	}

	private updateSlotInstance(slotX: number, slotZ: number): void {
		const slotIdx = slotZ * VIEW_DIAMETER + slotX;
		const world = this.chunks.getWorldCoord(slotX, slotZ);
		const ready = this.chunks.isSlotReady(slotX, slotZ);

		if (world && ready) {
			this.bbTransforms[slotIdx * 4 + 0] = world.cx;
			this.bbTransforms[slotIdx * 4 + 1] = this.chunks.getMinY(
				slotX,
				slotZ,
			);
			this.bbTransforms[slotIdx * 4 + 2] = world.cz;
			this.bbTransforms[slotIdx * 4 + 3] = this.chunks.getBBHeight(
				slotX,
				slotZ,
			);
		}

		this.slotReadyAttr[slotIdx] = ready ? 1 : 0;

		const transforms = this.bbGeom.getAttribute(
			'transforms',
		) as THREE.InstancedBufferAttribute;
		const readyAttr = this.bbGeom.getAttribute(
			'slotReady',
		) as THREE.InstancedBufferAttribute;
		transforms.needsUpdate = true;
		readyAttr.needsUpdate = true;
	}

	/** Copy a slot's height samples into the atlas CPU buffer and GPU subregion. */
	private uploadSlot(slotX: number, slotZ: number): void {
		const src = this.chunks.getChunkData(slotX, slotZ);
		const ofsX = slotX * CHUNK_SIZE;
		const ofsZ = slotZ * CHUNK_SIZE;

		for (let row = 0; row < CHUNK_SIZE; row++) {
			const srcStart = row * CHUNK_SIZE;
			const dstStart = (ofsZ + row) * HEIGHTMAP_SIZE + ofsX;
			this.heightmapData.set(
				src.subarray(srcStart, srcStart + CHUNK_SIZE),
				dstStart,
			);
		}

		const gl = this.webgl.getContext() as WebGL2RenderingContext;
		const properties = this.webgl.properties.get(this.heightmap);
		const textureProperties = properties as { __webglTexture?: WebGLTexture };
		const glTexture = textureProperties.__webglTexture;
		if (!glTexture) {
			this.heightmap.needsUpdate = true;
			return;
		}

		gl.bindTexture(gl.TEXTURE_2D, glTexture);
		gl.texSubImage2D(
			gl.TEXTURE_2D,
			0,
			ofsX,
			ofsZ,
			CHUNK_SIZE,
			CHUNK_SIZE,
			gl.RED,
			gl.FLOAT,
			src,
		);
	}

	private streamFromCamera(): void {
		const { cx: centerCx, cz: centerCz } = this.camera.getCenterChunk();

		if (centerCx === this.lastCenterCx && centerCz === this.lastCenterCz) {
			return;
		}

		this.lastCenterCx = centerCx;
		this.lastCenterCz = centerCz;
		this.chunks.onPlayerMove(centerCx, centerCz);

		for (let slotZ = 0; slotZ < VIEW_DIAMETER; slotZ++) {
			for (let slotX = 0; slotX < VIEW_DIAMETER; slotX++) {
				this.updateSlotInstance(slotX, slotZ);
			}
		}
	}

	private processReadySlots(): void {
		for (const { slotX, slotZ } of this.chunks.consumeReadySlots()) {
			this.uploadSlot(slotX, slotZ);
			this.updateSlotInstance(slotX, slotZ);
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
		this.camera.tick();
		this.sky.position.copy(this.camera.inner.position);
		this.streamFromCamera();
		this.processReadySlots();
		this.webgl.render(this.scene, this.camera.inner);
	}
}

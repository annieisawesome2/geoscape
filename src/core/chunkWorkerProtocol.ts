export interface GenerateRequest {
	type: 'generate';
	id: number;
	cx: number;
	cz: number;
	pixels: number;
}

export interface ChunkResult {
	type: 'result';
	id: number;
	cx: number;
	cz: number;
	pixels: number;
	heightMap: Float32Array;
	minY: number;
	maxY: number;
}

export interface ChunkError {
	type: 'error';
	id: number;
	message: string;
}

export type WorkerInMessage = GenerateRequest;
export type WorkerOutMessage = ChunkResult | ChunkError;

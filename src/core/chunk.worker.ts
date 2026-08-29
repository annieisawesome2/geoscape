import { generateHeightMap } from './terrainGen';
import type { WorkerInMessage, WorkerOutMessage } from './chunkWorkerProtocol';

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
	const msg = event.data;
	if (msg.type !== 'generate') {
		return;
	}

	try {
		const { id, cx, cz, pixels } = msg;
		const { heightMap, minY, maxY } = generateHeightMap(cx, cz, pixels);
		const result: WorkerOutMessage = {
			type: 'result',
			id,
			cx,
			cz,
			pixels,
			heightMap,
			minY,
			maxY,
		};
		self.postMessage(result, { transfer: [heightMap.buffer] });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const result: WorkerOutMessage = {
			type: 'error',
			id: msg.id,
			message,
		};
		self.postMessage(result);
	}
};

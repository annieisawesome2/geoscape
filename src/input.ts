type MouseCallback = (evt: PointerEvent) => void;

export class Input {
	#pressed = new Map<string, boolean>();
	#mouseCbs: MouseCallback[] = [];

	constructor(canvas: HTMLCanvasElement) {
		canvas.onpointerdown = (evt) => {
			canvas.onpointermove = (moveEvt) => {
				for (const cb of this.#mouseCbs) cb(moveEvt);
			};
			canvas.setPointerCapture(evt.pointerId);
		};
		canvas.onpointerup = (evt) => {
			canvas.onpointermove = null;
			canvas.releasePointerCapture(evt.pointerId);
		};

		document.addEventListener('keydown', (evt) => {
			this.#pressed.set(evt.code, true);
		});
		document.addEventListener('keyup', (evt) => {
			this.#pressed.delete(evt.code);
		});
	}

	isPressed(key: string): boolean {
		return this.#pressed.get(key) ?? false;
	}

	registerMouseCb(cb: MouseCallback): void {
		this.#mouseCbs.push(cb);
	}
}

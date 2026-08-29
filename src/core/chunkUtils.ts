/** True modulo — JS `%` is remainder, not modulo, for negative values. */
export function mod(n: number, m: number): number {
	return ((n % m) + m) % m;
}

export function chunkKey(cx: number, cz: number): string {
	return `${cx},${cz}`;
}

/** Atlas slot index for world chunk coord (cx, cz) in an N×N atlas. */
export function slotIndex(cx: number, cz: number, numChunks: number): number {
	return mod(cz, numChunks) * numChunks + mod(cx, numChunks);
}

export function slotCoord(
	slotIdx: number,
	numChunks: number,
): { slotX: number; slotZ: number } {
	return {
		slotX: slotIdx % numChunks,
		slotZ: Math.floor(slotIdx / numChunks),
	};
}

/** Inclusive min/max chunk coords for an N×N window centered on (centerCx, centerCz). */
export function windowBounds(
	centerCx: number,
	centerCz: number,
	numChunks: number,
): { minCx: number; maxCx: number; minCz: number; maxCz: number } {
	const half = Math.floor(numChunks / 2);
	return {
		minCx: centerCx - half,
		maxCx: centerCx - half + numChunks - 1,
		minCz: centerCz - half,
		maxCz: centerCz - half + numChunks - 1,
	};
}

/** World chunk coord in the window starting at min whose residue mod N equals residue. */
export function coordForResidue(
	min: number,
	residue: number,
	numChunks: number,
): number {
	const offset = mod(residue - mod(min, numChunks), numChunks);
	return min + offset;
}

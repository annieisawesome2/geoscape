/** Side length of the streamed N×N chunk atlas (world units ≈ VIEW_DIAMETER). */
export const VIEW_DIAMETER = 17;
/** Heightmap texels per chunk edge */
export const CHUNK_SIZE = 32;

export const HEIGHTMAP_SIZE = VIEW_DIAMETER * CHUNK_SIZE;

/** Streaming center so the initial window spans chunks [0 .. VIEW_DIAMETER - 1]. */
export const INITIAL_CENTER_CX = Math.floor(VIEW_DIAMETER / 2);
export const INITIAL_CENTER_CZ = Math.floor(VIEW_DIAMETER / 2);

/** World-space center of the initial terrain patch (center of chunk at INITIAL_CENTER). */
export const INITIAL_WORLD_X = INITIAL_CENTER_CX + 0.5;
export const INITIAL_WORLD_Z = INITIAL_CENTER_CZ + 0.5;

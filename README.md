# Development
- Make sure nodejs is installed
- `npm install` to get all dependencies
- `npm run dev` to open in your browser

# Layout
- `src/main.ts` — entry point
- `src/input.ts` — keyboard / pointer input
- `src/core/` — chunks and heightmap generation
- `src/render/` — camera, WebGL renderer, GLSL shaders (`vertex.glsl`, `fragment.glsl`)

# TODO
- (Optimization) Re-use a single Float32Array as buffer when generating instead of allocating new ones for every chunk
- (If time permits) (Optimization) Hierarchical heightmap tracing
- (If time permits) (Consistency) Seeded RNG
- (If time permits) (Compatibility) Investigate compatibility of float textures on WebGL 1

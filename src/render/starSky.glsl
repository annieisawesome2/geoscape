float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 starGlow(float dist, float brightness) {
	float core = exp(-dist * dist * 520.0) * brightness;
	float halo = exp(-dist * dist * 38.0) * brightness * 0.55;
	float bloom = exp(-dist * dist * 9.0) * brightness * 0.12;
	vec3 starWhite = vec3(1.0, 0.98, 0.95);
	return starWhite * (core + halo + bloom);
}

vec3 nightSkyColor(vec3 dir) {
	vec3 sky = vec3(0.01, 0.02, 0.09);
	vec3 d = normalize(dir);
	if (d.y <= 0.01) {
		return sky;
	}

	vec2 uv = d.xz / (d.y + 1.0);
	vec2 gv = uv * 320.0;
	vec2 cell = floor(gv);
	vec2 f = fract(gv) - 0.5;
	float h = hash21(cell);

	if (h > 0.997) {
		float brightness = (h - 0.997) / 0.003;
		float dist = length(f);
		sky += starGlow(dist, brightness);
	}

	return sky;
}

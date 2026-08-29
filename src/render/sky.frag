varying vec3 vWorldDir;

void main() {
	gl_FragColor = vec4(nightSkyColor(normalize(vWorldDir)), 1.0);
}

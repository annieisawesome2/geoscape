varying vec3 vWorldDir;

void main() {
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorldDir = worldPos.xyz - cameraPosition;
	gl_Position = projectionMatrix * viewMatrix * worldPos;
}

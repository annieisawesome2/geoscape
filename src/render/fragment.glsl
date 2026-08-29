uniform vec2 scrSize;
uniform sampler2D heightmap;
uniform float viewDiameter;

flat varying vec2 bufIdx;
flat varying float chunkReady;
varying float chunkMinY;
varying float chunkMaxY;
varying vec3 localPos;
varying mat4 invProjMat;
varying mat4 invViewMat;

const vec3 DOWN = vec3(0.0, -1.0, 0.0);

struct Ray {
	vec3 pos;
	vec3 dir;
};

// pos is undefined when hit is false
struct Hit {
	bool hit;
	vec3 pos;
	uint steps;
};

Ray getPrimaryRay() {
	vec2 uv = (gl_FragCoord.xy / scrSize) * 2.0 - 1.0;
	vec4 targ = invProjMat * vec4(uv, 1.0, 1.0);
	vec4 dir = invViewMat * vec4(normalize(targ.xyz / targ.w), 0.0);
	return Ray(localPos, normalize(dir.xyz));
}

bool outOfChunk(vec3 pos) {
	return pos.x < 0.0
		|| pos.x > 1.0
		|| pos.z < 0.0
		|| pos.z > 1.0
		|| pos.y < chunkMinY
		|| pos.y > chunkMaxY;
}

// xz in [0, 1] within the chunk
float getHeight(vec2 xz) {
	xz += bufIdx;
	xz /= viewDiameter;
	return texture(heightmap, xz).r;
}

bool sampleHeight(vec3 pos) {
	vec2 uv = (floor(pos.xz * 32.0) + 0.5) / 32.0;
	uv += bufIdx;
	uv /= viewDiameter;
	float height = texture(heightmap, uv).r;
	return height > pos.y + 1e-4;
}

Hit marchXZ(Ray primary) {
	vec3 P = primary.pos;
	vec3 D = primary.dir;

	vec2 pos2 = P.xz;
	vec2 dir2 = D.xz;

	// Near-vertical rays: sample height directly instead of missing.
	if (abs(dir2.x) < 1e-8 && abs(dir2.y) < 1e-8) {
		if (D.y < 0.0 && P.x >= 0.0 && P.x <= 1.0 && P.z >= 0.0 && P.z <= 1.0) {
			float h = getHeight(P.xz);
			if (P.y >= h - 1e-4) {
				return Hit(true, vec3(P.x, h, P.z), 0u);
			}
		}
		return Hit(false, vec3(0.0), 0u);
	}

	vec2 invDir2 = 1.0 / max(abs(dir2), vec2(1e-8));
	vec2 step2 = sign(dir2);

	vec2 voxelPos2 = pos2 * 32.0;
	vec2 voxelBase2 = floor(voxelPos2);
	vec2 voxelFrac2 = voxelPos2 - voxelBase2;

	vec2 tDelta2 = invDir2 / 32.0;
	vec2 tMax2;
	tMax2.x = (step2.x > 0.0 ? 1.0 - voxelFrac2.x : voxelFrac2.x) * invDir2.x / 32.0;
	tMax2.y = (step2.y > 0.0 ? 1.0 - voxelFrac2.y : voxelFrac2.y) * invDir2.y / 32.0;

	float t = 0.0;

	for (uint i = 0u; i < 128u; i++) {
		vec3 currPos = P + t * D;

		if (outOfChunk(currPos)) break;

		float h = getHeight(currPos.xz);
		if (currPos.y <= h + 1e-4) {
			return Hit(true, currPos, i);
		}

		if (tMax2.x < tMax2.y) {
			t = tMax2.x;
			tMax2.x += tDelta2.x;
		} else {
			t = tMax2.y;
			tMax2.y += tDelta2.y;
		}
	}

	return Hit(false, vec3(0.0), 0u);
}

Hit march(Ray primary) {
	vec3 P = primary.pos;
	vec3 D = primary.dir;

	vec3 voxelFrac = fract(P * 32.0);
	vec3 invD = 1.0 / max(abs(D), vec3(1e-8));
	vec3 tDelta = invD / 32.0;
	vec3 stepDir = sign(D);

	vec3 tMax;
	tMax.x = (stepDir.x > 0.0 ? 1.0 - voxelFrac.x : voxelFrac.x) * invD.x / 32.0;
	tMax.y = (stepDir.y > 0.0 ? 1.0 - voxelFrac.y : voxelFrac.y) * invD.y / 32.0;
	tMax.z = (stepDir.z > 0.0 ? 1.0 - voxelFrac.z : voxelFrac.z) * invD.z / 32.0;

	for (uint i = 0u; i < 64u; i++) {
		if (outOfChunk(P)) break;
		if (sampleHeight(P)) return Hit(true, P, i);

		if (tMax.x < tMax.y && tMax.x < tMax.z) {
			P.x += stepDir.x / 32.0;
			tMax.x += tDelta.x;
		} else if (tMax.y < tMax.z) {
			P.y += stepDir.y / 32.0;
			tMax.y += tDelta.y;
		} else {
			P.z += stepDir.z / 32.0;
			tMax.z += tDelta.z;
		}
	}

	return Hit(false, P, 0u);
}

vec3 heightColor(float h) {
	if (h < 0.3) {
		return mix(vec3(0.2, 0.1, 0.05), vec3(0.33, 0.27, 0.13), h / 0.3);
	} else if (h < 0.5) {
		return mix(vec3(0.33, 0.27, 0.13), vec3(0.1, 0.2, 0.1), (h - 0.3) / 0.2);
	} else if (h < 0.65) {
		return mix(vec3(0.1, 0.2, 0.1), vec3(0.0, 0.4, 0.0), (h - 0.5) / 0.15);
	} else if (h < 0.8) {
		return mix(vec3(0.0, 0.4, 0.0), vec3(0.0, 0.278, 0.0), (h - 0.65) / 0.15);
	} else {
		return mix(vec3(0.0, 0.278, 0.0), vec3(0.2, 0.6, 0.2), (h - 0.8) / 0.2);
	}
}

void main() {
	if (chunkReady < 0.5) {
		discard;
	}

	// Keep a defined color before march (helps some drivers); overwritten on hit.
	vec2 uv = gl_FragCoord.xy / scrSize;
	uv += bufIdx;
	uv /= viewDiameter;
	gl_FragColor = vec4(vec3(texture(heightmap, uv).r - 2.0), 1.0);

	Ray ray = getPrimaryRay();
	Hit hit;
	if (dot(ray.dir, DOWN) >= sqrt(2.0) / 2.0) {
		hit = marchXZ(ray);
	} else {
		hit = march(ray);
	}

	if (hit.hit) {
		float normY = clamp((hit.pos.y - chunkMinY) / (chunkMaxY - chunkMinY), 0.0, 1.0);
		vec3 baseColor = heightColor(normY);
		vec3 lightDir = normalize(vec3(0.5, 2.0, 0.5));
		float lightIntensity = clamp(dot(normalize(vec3(0.5, 1.0, 0.5)), lightDir), 0.0, 1.0);
		vec3 shadowTint = vec3(0.2, 0.5, 0.1);
		vec3 finalColor = mix(shadowTint, baseColor, lightIntensity);
		gl_FragColor = vec4(finalColor, 1.0);
	} else {
		discard;
	}
}

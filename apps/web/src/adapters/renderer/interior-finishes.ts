import { Color, type MeshStandardMaterial, Vector2 } from "three";
import { floorFinishColors, wallFinishColors } from "../../domain/interior-materials";
import type { SceneFloorMaterial, SceneWallFinishes } from "./rectangular-room-projection";

export function applyFloorInteriorFinish(material: MeshStandardMaterial, floor?: SceneFloorMaterial, patterned = true): void {
	if (!floor?.finish) return;
	const id = floor.finish.presetId;
	const pattern = patterned ? id === "light-oak" ? 1 : id === "matte-floor-tile" ? 2 : 0 : 0;
	const finish = new Color(floorFinishColors[id]);
	applySurfaceShader(material, {
		floor: true, right: finish, left: finish, rightPattern: pattern, leftPattern: pattern,
		anchor: new Vector2(floor.anchorXM, floor.anchorZM), leftNormal: new Vector2(0, 1),
	});
}

export function applyWallInteriorFinish(material: MeshStandardMaterial, faces?: SceneWallFinishes, patterned = true): void {
	if (!faces) return;
	applySurfaceShader(material, {
		floor: false,
		left: faces.left ? new Color(wallFinishColors[faces.left.presetId]) : undefined,
		right: faces.right ? new Color(wallFinishColors[faces.right.presetId]) : undefined,
		leftPattern: patterned && faces.left?.presetId === "neutral-wall-tile" ? 2 : 0,
		rightPattern: patterned && faces.right?.presetId === "neutral-wall-tile" ? 2 : 0,
		anchor: new Vector2(faces.anchorXM, faces.anchorZM), leftNormal: new Vector2(faces.normalX, faces.normalZ),
	});
}

interface SurfaceShaderOptions {
	readonly floor: boolean;
	readonly left?: Color;
	readonly right?: Color;
	readonly leftPattern: number;
	readonly rightPattern: number;
	readonly anchor: Vector2;
	readonly leftNormal: Vector2;
}

function applySurfaceShader(material: MeshStandardMaterial, settings: SurfaceShaderOptions): void {
	material.customProgramCacheKey = () => "interior-surface-v1";
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, {
			interiorFloor: { value: settings.floor },
			interiorLeftColor: { value: settings.left ?? new Color() },
			interiorRightColor: { value: settings.right ?? new Color() },
			interiorSides: { value: new Vector2(settings.left ? 1 : 0, settings.right ? 1 : 0) },
			interiorPatterns: { value: new Vector2(settings.leftPattern, settings.rightPattern) },
			interiorLeftNormal: { value: settings.leftNormal },
			interiorAnchor: { value: settings.anchor },
			interiorTileGrout: { value: new Color("#c7c1b7") },
		});
		shader.vertexShader = `varying vec3 vInteriorPosition;
varying vec3 vInteriorNormal;
${shader.vertexShader}`.replace("#include <begin_vertex>", `#include <begin_vertex>
vInteriorPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
vInteriorNormal = normalize(mat3(modelMatrix) * objectNormal);
`);
		shader.fragmentShader = `varying vec3 vInteriorPosition;
varying vec3 vInteriorNormal;
uniform bool interiorFloor;
uniform vec3 interiorLeftColor;
uniform vec3 interiorRightColor;
uniform vec2 interiorSides;
uniform vec2 interiorPatterns;
uniform vec2 interiorLeftNormal;
uniform vec2 interiorAnchor;
uniform vec3 interiorTileGrout;

vec3 interiorPattern(vec3 finish, vec2 point, float pattern) {
	if (pattern < 0.5) return finish;
	if (pattern > 1.5) {
		vec2 cell = point / 0.300;
		vec2 edge = min(fract(cell), 1.0 - fract(cell));
		vec2 line = smoothstep(vec2(0.002), vec2(0.008) + fwidth(cell), edge);
		return mix(interiorTileGrout, finish, line.x * line.y);
	}
	float row = point.y / 0.140;
	vec2 cell = vec2(point.x / 0.900 + mod(floor(row), 2.0) * 0.5, row);
	vec2 edge = min(fract(cell), 1.0 - fract(cell));
	vec2 cut = smoothstep(vec2(0.001), vec2(0.009) + fwidth(cell), edge);
	float tone = fract(sin(dot(floor(cell), vec2(19.63, 73.12))) * 43758.55);
	float grain = sin(point.y * 580.0 + sin(point.x * 9.0) + tone * 3.3) * 0.017;
	return finish * (0.87 + tone * 0.15 + grain) * mix(0.76, 1.0, cut.x * cut.y);
}
${shader.fragmentShader}`.replace("#include <color_fragment>", `#include <color_fragment>
vec2 placement = vInteriorPosition.xz + interiorAnchor;
if (interiorFloor && vInteriorNormal.y > 0.9) {
	diffuseColor.rgb = interiorPattern(interiorLeftColor, placement, interiorPatterns.x);
} else if (!interiorFloor) {
	float alignment = dot(normalize(vInteriorNormal), vec3(interiorLeftNormal.x, 0.0, interiorLeftNormal.y));
	vec2 tangent = vec2(interiorLeftNormal.y, -interiorLeftNormal.x);
	if (tangent.x < -0.0001 || (abs(tangent.x) < 0.0001 && tangent.y < 0.0)) tangent = -tangent;
	vec2 sidePoint = vec2(dot(placement, tangent), vInteriorPosition.y);
	if (alignment > 0.98 && interiorSides.x > 0.5) diffuseColor.rgb = interiorPattern(interiorLeftColor, sidePoint, interiorPatterns.x);
	if (alignment < -0.98 && interiorSides.y > 0.5) diffuseColor.rgb = interiorPattern(interiorRightColor, sidePoint, interiorPatterns.y);
}
`);
	};
}

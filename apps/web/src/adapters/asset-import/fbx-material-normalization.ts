import { Mesh, type Material, type Object3D, type Texture } from "three";

interface EmissiveMaterial extends Material {
	readonly emissive?: {
		readonly b: number;
		readonly g: number;
		readonly r: number;
		setRGB(r: number, g: number, b: number): void;
	};
	readonly emissiveMap?: Texture | null;
}

/**
 * Blender-derived FBX files can encode the default non-emissive material
 * colour as a fully white Phong emissive value. GLTFExporter keeps that value
 * and it then saturates every base-colour texture in a PBR preview. Remove
 * only this untextured white sentinel; actual coloured or mapped emission is
 * left intact.
 */
export function normalizeStaticFbxMaterialLighting(scene: Object3D): void {
	scene.traverse((object) => {
		if (!(object instanceof Mesh)) return;
		const materials = Array.isArray(object.material)
			? object.material
			: [object.material];
		materials.forEach((material) => {
			normalizeMaterial(material);
		});
	});
}

function normalizeMaterial(material: Material): void {
	const emissiveMaterial = material as EmissiveMaterial;
	const emissive = emissiveMaterial.emissive;
	if (
		!emissive ||
		emissiveMaterial.emissiveMap ||
		emissive.r < 0.99 ||
		emissive.g < 0.99 ||
		emissive.b < 0.99
	) {
		return;
	}
	emissive.setRGB(0, 0, 0);
	material.needsUpdate = true;
}

import type { Material, Object3D, Texture } from "three";

interface DisposableGeometry {
	dispose(): void;
}

interface RenderableObject extends Object3D {
	readonly geometry?: DisposableGeometry;
	readonly material?: Material | readonly Material[];
}

interface ClosableImage {
	close?(): void;
}

function isTexture(value: unknown): value is Texture {
	return (
		typeof value === "object" &&
		value !== null &&
		"dispose" in value &&
		typeof value.dispose === "function" &&
		"image" in value
	);
}

/**
 * Three does not release textures when a Material is disposed. ImageBitmap
 * backing objects also need an explicit close. Dispose a parsed import as one
 * ownership unit whenever its temporary preview or cache is no longer used.
 */
export function disposeThreeObject3D(root: Object3D): void {
	const textures = new Set<Texture>();
	root.traverse((node) => {
		const renderable = node as RenderableObject;
		renderable.geometry?.dispose();
		const materials = renderable.material
			? Array.isArray(renderable.material)
				? renderable.material
				: [renderable.material]
			: [];
		for (const material of materials) {
			for (const value of Object.values(material)) {
				if (isTexture(value)) textures.add(value);
			}
			material.dispose();
		}
	});
	for (const texture of textures) {
		(texture.image as ClosableImage | undefined)?.close?.();
		texture.dispose();
	}
}

import type { Texture } from "three";

export type LocalTextureMimeType = "image/jpeg" | "image/png" | "image/webp";

/**
 * GLTFExporter preserves image compression only when this metadata is present
 * on the decoded Three texture. Without it, JPEG sidecars silently become PNG.
 */
export function preserveLocalTextureMimeType(
	texture: Pick<Texture, "userData">,
	mimeType: LocalTextureMimeType,
): void {
	texture.userData.mimeType = mimeType;
}

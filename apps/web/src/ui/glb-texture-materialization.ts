import type { Material, Object3D, Texture } from "three";

interface RenderableObject extends Object3D {
	readonly material?: Material | readonly Material[];
}

interface ClosableImage {
	close?(): void;
}

interface DrawableImageDimensions {
	readonly height: number;
	readonly width: number;
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

function drawableImageDimensions(value: unknown): DrawableImageDimensions | undefined {
	if (value === null || typeof value !== "object") return undefined;
	const candidate = value as Partial<DrawableImageDimensions>;
	return Number.isInteger(candidate.width) &&
		Number.isInteger(candidate.height) &&
		(candidate.width ?? 0) > 0 &&
		(candidate.height ?? 0) > 0
		? { height: candidate.height as number, width: candidate.width as number }
		: undefined;
}

/**
 * GLTFLoader decodes GLB images to ImageBitmap. Some mobile WebGL paths detach
 * that source during a later GPU upload, turning otherwise valid PBR models
 * black. Copy once into canvas-backed pixels owned by this renderer session.
 */
export function materializeGlbTextureSources(
	root: Object3D,
	createCanvas: () => HTMLCanvasElement = () => document.createElement("canvas"),
): boolean {
	const textures = new Set<Texture>();
	root.traverse((node) => {
		const renderable = node as RenderableObject;
		if (!renderable.material) return;
		const materials = Array.isArray(renderable.material)
			? renderable.material
			: [renderable.material];
		for (const material of materials) {
			for (const value of Object.values(material)) {
				if (isTexture(value)) textures.add(value);
			}
		}
	});

	const canvasBySource = new Map<object, HTMLCanvasElement>();
	const sourcesToClose = new Set<ClosableImage>();
	let succeeded = true;
	for (const texture of textures) {
		const source = texture.image;
		const dimensions = drawableImageDimensions(source);
		if (!dimensions) continue;
		const cachedCanvas = canvasBySource.get(source as object);
		if (cachedCanvas) {
			texture.image = cachedCanvas;
			texture.needsUpdate = true;
			continue;
		}
		let canvas: HTMLCanvasElement;
		let context: CanvasRenderingContext2D | null;
		try {
			canvas = createCanvas();
			canvas.width = dimensions.width;
			canvas.height = dimensions.height;
			context = canvas.getContext("2d");
		} catch {
			succeeded = false;
			continue;
		}
		if (!context) {
			succeeded = false;
			continue;
		}
		try {
			context.drawImage(
				source as CanvasImageSource,
				0,
				0,
				dimensions.width,
				dimensions.height,
			);
		} catch {
			succeeded = false;
			continue;
		}
		canvasBySource.set(source as object, canvas);
		sourcesToClose.add(source as ClosableImage);
		texture.image = canvas;
		texture.needsUpdate = true;
	}
	for (const source of sourcesToClose) {
		if (typeof source.close !== "function") continue;
		try {
			source.close();
		} catch {
			// The canvas copy is already usable; a failed optional close is harmless.
		}
	}
	return succeeded;
}

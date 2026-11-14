import {
	Bone,
	Camera,
	Light,
	Loader,
	LoadingManager,
	Mesh,
	type Object3D,
	SkinnedMesh,
	Texture,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

import {
	type FbxSidecarResource,
	findFbxTextureSidecar,
} from "./fbx-bundle-import";
import { normalizeStaticFbxMaterialLighting } from "./fbx-material-normalization";
import { preserveLocalTextureMimeType } from "./fbx-texture-mime";
import { normalizeFbxUnitsToMetres } from "./fbx-unit-normalization";

const MAXIMUM_NORMALIZED_GLB_BYTES = 25 * 1024 * 1024;

type WorkerRequest = {
	readonly kind: "convert-static-fbx";
	readonly sidecarResources: readonly WorkerSidecarResource[];
	readonly sourceBytes: ArrayBuffer;
};

interface WorkerSidecarResource extends Omit<FbxSidecarResource, "bytes"> {
	readonly bytes: ArrayBuffer;
}

type WorkerResponse =
	| { readonly glbBytes: ArrayBuffer; readonly kind: "converted" }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "FBX_CONVERSION_FAILED"
				| "FBX_CONVERSION_OUTPUT_LIMIT"
				| "FBX_EXTERNAL_RESOURCE"
				| "FBX_UNSUPPORTED_SCENE_CONTENT";
	  };

interface FbxConversionWorkerScope {
	addEventListener(
		type: "message",
		listener: (event: MessageEvent<unknown>) => void,
	): void;
	postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
}

class ExternalResourceAttempt extends Error {}

const workerScope = globalThis as unknown as FbxConversionWorkerScope;

workerScope.addEventListener("message", (event) => {
	const request = parseRequest(event.data);
	if (!request) return;
	void convert(request);
});

async function convert(request: WorkerRequest): Promise<void> {
	const fbxWindowScope = globalThis as unknown as { window?: unknown };
	const originalWindow = fbxWindowScope.window;
	try {
		const manager = new LoadingManager();
		const textureLoader = new LocalTextureLoader(
			manager,
			request.sidecarResources,
		);
		manager.addHandler(/\.(?:jpe?g|png|webp)$/i, textureLoader);
		// Default loader paths are denied. The only texture data admitted below is
		// either embedded in the user's FBX or another File selected in this same
		// picker action; neither case receives a network URL.
		manager.setURLModifier(() => {
			throw new ExternalResourceAttempt();
		});
		fbxWindowScope.window = globalThis;
		const scene = new FBXLoader(manager).parse(request.sourceBytes, "");
		normalizeFbxUnitsToMetres(scene);
		assertStaticScene(scene);
		normalizeStaticFbxMaterialLighting(scene);
		await textureLoader.complete();
		const output = await new GLTFExporter().parseAsync(scene, {
			binary: true,
			maxTextureSize: 2048,
			onlyVisible: false,
			trs: true,
		});
		if (!(output instanceof ArrayBuffer) || !isBinaryGlbV2(output)) {
			reject("FBX_CONVERSION_FAILED");
			return;
		}
		if (output.byteLength > MAXIMUM_NORMALIZED_GLB_BYTES) {
			reject("FBX_CONVERSION_OUTPUT_LIMIT");
			return;
		}
		workerScope.postMessage({ glbBytes: output, kind: "converted" }, [output]);
	} catch (error) {
		reject(
			error instanceof ExternalResourceAttempt
				? "FBX_EXTERNAL_RESOURCE"
				: error instanceof UnsupportedStaticFbxScene
					? "FBX_UNSUPPORTED_SCENE_CONTENT"
					: "FBX_CONVERSION_FAILED",
		);
	} finally {
		fbxWindowScope.window = originalWindow;
	}
}

class UnsupportedStaticFbxScene extends Error {}

/**
 * `TextureLoader` depends on a document-backed Image element. This dedicated
 * worker instead decodes only files selected in the same browser action into
 * ImageBitmaps, which GLTFExporter can embed through OffscreenCanvas.
 */
class LocalTextureLoader extends Loader<Texture> {
	private readonly pending = new Set<Promise<void>>();
	private readonly resources: readonly FbxSidecarResource[];

	public constructor(
		manager: LoadingManager,
		resources: readonly WorkerSidecarResource[],
	) {
		super(manager);
		this.resources = resources.map((resource) => ({
			bytes: new Uint8Array(resource.bytes),
			mimeType: resource.mimeType,
			name: resource.name,
		}));
	}

	public override load(
		url: string,
		onLoad?: (texture: Texture) => void,
		_onProgress?: unknown,
		onError?: (event: unknown) => void,
	): Texture {
		const texture = new Texture();
		this.manager.itemStart(url);
		const task = this.loadIntoTexture(url, texture, onLoad, onError)
			.catch((error) => {
				this.manager.itemError(url);
				onError?.(error);
				throw error;
			})
			.finally(() => this.manager.itemEnd(url));
		this.pending.add(task);
		void task.then(
			() => this.pending.delete(task),
			() => this.pending.delete(task),
		);
		return texture;
	}

	public async complete(): Promise<void> {
		await Promise.all([...this.pending]);
	}

	private async loadIntoTexture(
		url: string,
		texture: Texture,
		onLoad?: (texture: Texture) => void,
		_onError?: (event: unknown) => void,
	): Promise<void> {
		const resource = await this.resourceFor(url);
		if (typeof createImageBitmap !== "function") {
			throw new UnsupportedStaticFbxScene();
		}
		const image = await createImageBitmap(resource.blob);
		texture.image = image;
		preserveLocalTextureMimeType(texture, resource.mimeType);
		texture.needsUpdate = true;
		onLoad?.(texture);
	}

	private async resourceFor(url: string): Promise<{
		readonly blob: Blob;
		readonly mimeType: FbxSidecarResource["mimeType"];
	}> {
		if (url.startsWith("blob:")) {
			const response = await fetch(url);
			if (!response.ok) throw new ExternalResourceAttempt();
			const blob = await response.blob();
			const mimeType = supportedTextureMimeType(blob.type);
			if (!mimeType) throw new ExternalResourceAttempt();
			return { blob, mimeType };
		}
		const resource = findFbxTextureSidecar(this.resources, url);
		if (!resource) throw new ExternalResourceAttempt();
		const bytes = new Uint8Array(resource.bytes.byteLength);
		bytes.set(resource.bytes);
		return {
			blob: new Blob([bytes.buffer], { type: resource.mimeType }),
			mimeType: resource.mimeType,
		};
	}
}

function supportedTextureMimeType(
	mimeType: string,
): FbxSidecarResource["mimeType"] | undefined {
	return mimeType === "image/jpeg" ||
		mimeType === "image/png" ||
		mimeType === "image/webp"
		? mimeType
		: undefined;
}

function assertStaticScene(scene: Object3D): void {
	if (
		"animations" in scene &&
		Array.isArray(scene.animations) &&
		scene.animations.length > 0
	) {
		throw new UnsupportedStaticFbxScene();
	}
	scene.traverse((object) => {
		if (
			object instanceof Bone ||
			object instanceof Camera ||
			object instanceof Light ||
			object instanceof SkinnedMesh ||
			(object instanceof Mesh && object.morphTargetInfluences !== undefined)
		) {
			throw new UnsupportedStaticFbxScene();
		}
		// Imported userData is neither custom-asset semantics nor executable
		// metadata. Strip it before the normalized GLB is emitted.
		object.userData = {};
	});
}

function isBinaryGlbV2(bytes: ArrayBuffer): boolean {
	if (bytes.byteLength < 20) return false;
	const view = new DataView(bytes);
	return (
		view.getUint32(0, true) === 0x46546c67 &&
		view.getUint32(4, true) === 2 &&
		view.getUint32(8, true) === bytes.byteLength
	);
}

function parseRequest(value: unknown): WorkerRequest | undefined {
	if (!value || typeof value !== "object") return undefined;
	const candidate = value as Partial<WorkerRequest>;
	if (
		candidate.kind !== "convert-static-fbx" ||
		!(candidate.sourceBytes instanceof ArrayBuffer) ||
		!Array.isArray(candidate.sidecarResources)
	) {
		return undefined;
	}
	const sidecarResources: WorkerSidecarResource[] = [];
	for (const resource of candidate.sidecarResources) {
		if (!resource || typeof resource !== "object") return undefined;
		const sidecar = resource as Partial<WorkerSidecarResource>;
		if (
			!(sidecar.bytes instanceof ArrayBuffer) ||
			typeof sidecar.name !== "string" ||
			(sidecar.mimeType !== "image/jpeg" &&
				sidecar.mimeType !== "image/png" &&
				sidecar.mimeType !== "image/webp")
		) {
			return undefined;
		}
		sidecarResources.push({
			bytes: sidecar.bytes,
			mimeType: sidecar.mimeType,
			name: sidecar.name,
		});
	}
	return {
		kind: candidate.kind,
		sidecarResources,
		sourceBytes: candidate.sourceBytes,
	};
}

function reject(
	reasonCode: Extract<
		WorkerResponse,
		{ readonly kind: "rejected" }
	>["reasonCode"],
): void {
	workerScope.postMessage({ kind: "rejected", reasonCode });
}

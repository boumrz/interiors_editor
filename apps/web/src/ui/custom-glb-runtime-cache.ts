import type { RectangularRoomWebGlScene } from "../adapters/renderer/rectangular-room-projection";

/** Exact local bytes resolved from an immutable CustomAsset resource reference. */
export interface CustomGlbResource {
	readonly bytes: Uint8Array;
	readonly resourceHash: string;
}

export interface ParsedCustomGlbModel<T> {
	readonly assetDefinitionId: string;
	readonly root: T;
}

interface CacheEntry<T> {
	readonly promise: Promise<T | undefined>;
}

/**
 * A renderer-local, hash-keyed cache. A Project revision may change an item
 * pose many times while its pinned bytes remain identical; decode that
 * immutable resource once, including when two definitions share it.
 */
export class CustomGlbRuntimeCache<T> {
	private readonly entries = new Map<string, CacheEntry<T>>();

	public async load(
		assetDefinitionId: string,
		resource: CustomGlbResource,
		parse: (bytes: Uint8Array) => Promise<T | undefined>,
	): Promise<ParsedCustomGlbModel<T> | undefined> {
		let entry = this.entries.get(resource.resourceHash);
		if (!entry) {
			entry = { promise: parse(resource.bytes) };
			this.entries.set(resource.resourceHash, entry);
		}
		const root = await entry.promise;
		return root === undefined ? undefined : { assetDefinitionId, root };
	}

	/** Release decoded GPU resources as soon as no active scene refers to their hash. */
	public async evictExcept(
		retainedResourceHashes: ReadonlySet<string>,
		disposeRoot: (root: T) => void,
	): Promise<void> {
		const staleEntries = [...this.entries.entries()].flatMap(
			([resourceHash, entry]) =>
				retainedResourceHashes.has(resourceHash) ? [] : [entry],
		);
		for (const resourceHash of this.entries.keys()) {
			if (!retainedResourceHashes.has(resourceHash)) {
				this.entries.delete(resourceHash);
			}
		}
		const roots = await Promise.all(staleEntries.map((entry) => entry.promise));
		for (const root of roots) {
			if (root !== undefined) disposeRoot(root);
		}
	}

	/** Dispose retained parsed data, including entries that are still decoding. */
	public async dispose(disposeRoot: (root: T) => void): Promise<void> {
		const roots = await Promise.all(
			[...this.entries.values()].map((entry) => entry.promise),
		);
		this.entries.clear();
		for (const root of roots) {
			if (root !== undefined) disposeRoot(root);
		}
	}
}

/**
 * GLTFLoader accepts an ArrayBuffer. Preserve the original immutable backing
 * store whenever the resource is a complete view; copied slices are required
 * only for an offset view, otherwise unrelated bytes would be exposed.
 */
export function arrayBufferForGlbParse(bytes: Uint8Array): ArrayBuffer {
	if (
		bytes.buffer instanceof ArrayBuffer &&
		bytes.byteOffset === 0 &&
		bytes.byteLength === bytes.buffer.byteLength
	) {
		return bytes.buffer;
	}
	return bytes.slice().buffer;
}

/**
 * The Three renderer can update x/z/yaw/size by applying a pose and can swap a
 * decoded GLB root in place. Only room topology or an item's visual identity
 * requires rebuilding its disposable shell graph.
 */
export function rendererStructureKeyFor(
	scene: RectangularRoomWebGlScene,
): string {
	return JSON.stringify({
		floors: scene.floors,
		floorPolygons: scene.floorPolygons,
		items: scene.items.map((item) => ({
			assetDefinitionId: item.assetDefinitionId,
			assetInstanceId: item.assetInstanceId,
			material: item.material,
		})),
		walls: scene.walls,
		openingParts: scene.openingParts,
	});
}

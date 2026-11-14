import { Box3, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { arrayBufferForGlbParse } from "./custom-glb-runtime-cache";
import { materializeGlbTextureSources } from "./glb-texture-materialization";
import { disposeThreeObject3D } from "./three-resource-disposal";

export interface CustomGlbRuntimeSourceDimensions {
	readonly depthM: number;
	readonly heightM: number;
	readonly widthM: number;
}

export interface ParsedCustomGlbRuntime {
	readonly document: unknown;
	readonly root: Object3D;
}

export interface CustomGlbRuntimeModel extends ParsedCustomGlbRuntime {
	readonly sourceDimensionsM: CustomGlbRuntimeSourceDimensions;
}

export type CustomGlbRuntimeParser = (
	bytes: Uint8Array,
) => Promise<ParsedCustomGlbRuntime | undefined>;

interface ThreeGltfLoaderAdapter {
	parse(
		bytes: ArrayBuffer,
		baseUrl: string,
		onLoad: (parsed: {
			readonly parser: { readonly json: unknown };
			readonly scene: Object3D | null | undefined;
		}) => void,
		onError: () => void,
	): void;
}

interface CustomGlbRuntimeLoaderOptions {
	readonly dispose?: (root: Object3D) => void;
	readonly materialize?: (root: Object3D) => boolean;
	readonly parse?: CustomGlbRuntimeParser;
}

/**
 * The only renderer-side route for an admitted custom GLB. It deliberately
 * stays below the domain/application validation boundary: bytes have already
 * been preflighted and pinned, while this returns only disposable Three data.
 */
export async function loadCustomGlbRuntime(
	bytes: Uint8Array,
	{
		dispose = disposeThreeObject3D,
		materialize = materializeGlbTextureSources,
		parse = parseCustomGlbWithThreeLoader,
	}: CustomGlbRuntimeLoaderOptions = {},
): Promise<CustomGlbRuntimeModel | undefined> {
	let parsed: ParsedCustomGlbRuntime | undefined;
	try {
		parsed = await parse(bytes);
	} catch {
		// The parser result remains undefined and never reaches either renderer.
	}
	if (!parsed || !isObject3D(parsed.root)) return undefined;

	let sourceDimensionsM: CustomGlbRuntimeSourceDimensions | undefined;
	try {
		sourceDimensionsM = sourceDimensionsFor(parsed.root);
	} catch {
		// A malformed decoder result is equivalent to an empty root: neither is
		// allowed to reach a renderer and the shared disposal path stays below.
	}
	if (!sourceDimensionsM) {
		dispose(parsed.root);
		return undefined;
	}

	try {
		if (!materialize(parsed.root)) {
			dispose(parsed.root);
			return undefined;
		}
	} catch {
		dispose(parsed.root);
		return undefined;
	}
	return { ...parsed, sourceDimensionsM };
}

export function parseCustomGlbWithThreeLoader(
	bytes: Uint8Array,
	loader: ThreeGltfLoaderAdapter = new GLTFLoader() as unknown as ThreeGltfLoaderAdapter,
): Promise<ParsedCustomGlbRuntime | undefined> {
	return new Promise((resolve) => {
		try {
			loader.parse(
				arrayBufferForGlbParse(bytes),
				"",
				(parsed) => {
					if (!isObject3D(parsed.scene)) {
						resolve(undefined);
						return;
					}
					resolve({ document: parsed.parser.json, root: parsed.scene });
				},
				() => resolve(undefined),
			);
		} catch {
			resolve(undefined);
		}
	});
}

function isObject3D(value: unknown): value is Object3D {
	if (value === null || typeof value !== "object") return false;
	return (
		"traverse" in value &&
		typeof (value as { readonly traverse?: unknown }).traverse === "function"
	);
}

function sourceDimensionsFor(
	root: Object3D,
): CustomGlbRuntimeSourceDimensions | undefined {
	const size = new Box3().setFromObject(root).getSize(new Vector3());
	return customGlbRuntimeDimensionsFor(size);
}

export function customGlbRuntimeDimensionsFor(size: {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}): CustomGlbRuntimeSourceDimensions | undefined {
	const values = [size.x, size.y, size.z];
	return values.every((value) => Number.isFinite(value) && value > 0)
		? { depthM: size.z, heightM: size.y, widthM: size.x }
		: undefined;
}

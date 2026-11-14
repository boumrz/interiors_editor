import { describe, expect, it } from "@rstest/core";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

import {
	customGlbRuntimeDimensionsFor,
	loadCustomGlbRuntime,
	parseCustomGlbWithThreeLoader,
	type CustomGlbRuntimeParser,
} from "./custom-glb-runtime-loader";

describe("loadCustomGlbRuntime", () => {
	it("requires every source dimension to be finite and positive", () => {
		expect(customGlbRuntimeDimensionsFor({ x: 1, y: 2, z: 3 })).toEqual({
			depthM: 3,
			heightM: 2,
			widthM: 1,
		});
		for (const size of [
			{ x: 0, y: 2, z: 3 },
			{ x: 1, y: 0, z: 3 },
			{ x: 1, y: 2, z: 0 },
			{ x: Number.POSITIVE_INFINITY, y: 2, z: 3 },
			{ x: 1, y: Number.NaN, z: 3 },
		]) {
			expect(customGlbRuntimeDimensionsFor(size)).toBeUndefined();
		}
	});

	it("uses an exact local ArrayBuffer and empty base URL when it bridges to Three's loader", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const root = texturedRoot();
		let parsedBuffer: ArrayBuffer | undefined;
		let parsedPath: string | undefined;

		const result = await parseCustomGlbWithThreeLoader(bytes, {
			parse: (buffer, path, onLoad) => {
				parsedBuffer = buffer;
				parsedPath = path;
				onLoad({ parser: { json: { asset: { version: "2.0" } } }, scene: root });
			},
		});

		expect(parsedBuffer).toBe(bytes.buffer);
		expect(parsedPath).toBe("");
		expect(result).toEqual({
			document: { asset: { version: "2.0" } },
			root,
		});
	});

	it("contains loader callback and construction failures without a renderer root", async () => {
		const callbackFailure = await parseCustomGlbWithThreeLoader(
			new Uint8Array([1]),
			{
				parse: (_buffer, _path, _onLoad, onError) => onError(),
			},
		);
		const constructionFailure = await parseCustomGlbWithThreeLoader(
			new Uint8Array([1]),
			{
				parse: () => {
					throw new Error("loader unavailable");
				},
			},
		);

		expect(callbackFailure).toBeUndefined();
		expect(constructionFailure).toBeUndefined();
	});

	it("rejects a loader result that has no default scene or no Three object shape", async () => {
		const noDefaultScene = await parseCustomGlbWithThreeLoader(
			new Uint8Array([1]),
			{
				parse: (_buffer, _path, onLoad) =>
					onLoad({ parser: { json: {} }, scene: undefined }),
			},
		);
		const nullScene = await parseCustomGlbWithThreeLoader(
			new Uint8Array([1]),
			{
				parse: (_buffer, _path, onLoad) =>
					onLoad({ parser: { json: {} }, scene: null }),
			},
		);
		const nonThreeScene = await parseCustomGlbWithThreeLoader(
			new Uint8Array([1]),
			{
				parse: (_buffer, _path, onLoad) =>
					onLoad({ parser: { json: {} }, scene: {} as never }),
			},
		);
		const nonFunctionTraverseScene = await parseCustomGlbWithThreeLoader(
			new Uint8Array([1]),
			{
				parse: (_buffer, _path, onLoad) =>
					onLoad({ parser: { json: {} }, scene: { traverse: 0 } as never }),
			},
		);

		expect(noDefaultScene).toBeUndefined();
		expect(nullScene).toBeUndefined();
		expect(nonThreeScene).toBeUndefined();
		expect(nonFunctionTraverseScene).toBeUndefined();
	});

	it("prepares the exact admitted bytes once before either renderer can own a textured root", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const root = texturedRoot();
		let parsedBytes: Uint8Array | undefined;
		let materializedRoot: Group | undefined;
		const parser: CustomGlbRuntimeParser = async (candidate) => {
			parsedBytes = candidate;
			return { document: { asset: { version: "2.0" } }, root };
		};

		const result = await loadCustomGlbRuntime(bytes, {
			materialize: (candidate) => {
				materializedRoot = candidate as Group;
				return true;
			},
			parse: parser,
		});

		expect(parsedBytes).toBe(bytes);
		expect(materializedRoot).toBe(root);
		expect(result).toEqual({
			document: { asset: { version: "2.0" } },
			root,
			sourceDimensionsM: { depthM: 3, heightM: 2, widthM: 1 },
		});
	});

	it("rejects an empty decoded root before texture preparation and disposes its temporary renderer resources", async () => {
		const root = new Group();
		let materialized = false;
		const disposed: Group[] = [];

		const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
			dispose: (candidate) => disposed.push(candidate as Group),
			materialize: () => {
				materialized = true;
				return true;
			},
			parse: async () => ({ document: {}, root }),
		});

		expect(result).toBeUndefined();
		expect(materialized).toBe(false);
		expect(disposed).toEqual([root]);
	});

	it.each([
		["width", 0, 2, 3],
		["height", 1, 0, 3],
		["depth", 1, 2, 0],
	] as const)(
		"rejects a decoded root with zero %s before either renderer receives it",
		async (_axis, width, height, depth) => {
			const root = new Group();
			root.add(new Mesh(new BoxGeometry(width, height, depth), new MeshStandardMaterial()));
			let materialized = false;

			const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
				materialize: () => {
					materialized = true;
					return true;
				},
				parse: async () => ({ document: {}, root }),
			});

			expect(result).toBeUndefined();
			expect(materialized).toBe(false);
		},
	);

	it("rejects a decoded root whose world transform creates a non-finite bound", async () => {
		const root = texturedRoot();
		root.scale.x = Number.POSITIVE_INFINITY;
		let materialized = false;

		const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
			materialize: () => {
				materialized = true;
				return true;
			},
			parse: async () => ({ document: {}, root }),
		});

		expect(result).toBeUndefined();
		expect(materialized).toBe(false);
	});

	it("keeps parser failures outside both renderer branches without creating a temporary root", async () => {
		let materialized = false;

		const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
			materialize: () => {
				materialized = true;
				return true;
			},
			parse: async () => undefined,
		});

		expect(result).toBeUndefined();
		expect(materialized).toBe(false);
	});

	it("rejects an invalid decoded scene root without leaving either renderer loading", async () => {
		let materialized = false;

		const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
			materialize: () => {
				materialized = true;
				return true;
			},
			parse: async () => ({ document: {}, root: undefined as never }),
		});

		expect(result).toBeUndefined();
		expect(materialized).toBe(false);
	});

	it("contains a malformed Three-shaped root whose bounds cannot be calculated", async () => {
		const malformedRoot = {
			traverse: () => {
				throw new Error("malformed scene");
			},
		} as never;
		const disposed: unknown[] = [];
		let materialized = false;

		const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
			dispose: (candidate) => disposed.push(candidate),
			materialize: () => {
				materialized = true;
				return true;
			},
			parse: async () => ({ document: {}, root: malformedRoot }),
		});

		expect(result).toBeUndefined();
		expect(materialized).toBe(false);
		expect(disposed).toEqual([malformedRoot]);
	});

	it("turns an unexpected parser exception into the same no-root result", async () => {
		let materialized = false;

		const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
			materialize: () => {
				materialized = true;
				return true;
			},
			parse: async () => {
				throw new Error("decoder failed");
			},
		});

		expect(result).toBeUndefined();
		expect(materialized).toBe(false);
	});

	it("disposes a successfully decoded root if mobile-safe texture preparation fails", async () => {
		const root = texturedRoot();
		const disposed: Group[] = [];

		const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
			dispose: (candidate) => disposed.push(candidate as Group),
			materialize: () => {
				throw new Error("canvas unavailable");
			},
			parse: async () => ({ document: {}, root }),
		});

		expect(result).toBeUndefined();
		expect(disposed).toEqual([root]);
	});

	it("disposes a successfully decoded root when texture copying reports an unsafe source", async () => {
		const root = texturedRoot();
		const disposed: Group[] = [];

		const result = await loadCustomGlbRuntime(new Uint8Array([1]), {
			dispose: (candidate) => disposed.push(candidate as Group),
			materialize: () => false,
			parse: async () => ({ document: {}, root }),
		});

		expect(result).toBeUndefined();
		expect(disposed).toEqual([root]);
	});
});

function texturedRoot(): Group {
	const root = new Group();
	root.add(
		new Mesh(
			new BoxGeometry(1, 2, 3),
			new MeshStandardMaterial({ color: "#f3f0e9" }),
		),
	);
	return root;
}

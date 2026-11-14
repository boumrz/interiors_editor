import { describe, expect, it } from "@rstest/core";

import type { RectangularRoomWebGlScene } from "../adapters/renderer/rectangular-room-projection";
import {
	arrayBufferForGlbParse,
	type CustomGlbResource,
	CustomGlbRuntimeCache,
	rendererStructureKeyFor,
} from "./custom-glb-runtime-cache";

const scene: RectangularRoomWebGlScene = {
	cameraBounds: { centerXM: 2, centerZM: 2, depthM: 4, widthM: 4 },
	dimensions: { depthMm: 4000, heightMm: 2600, widthMm: 4000 },
	floors: [],
	items: [
		{
			assetDefinitionId: "chair-definition",
			assetInstanceId: "chair-instance",
			centerXM: 1,
			centerYM: 0.5,
			centerZM: 1,
			depthM: 1,
			heightM: 1,
			widthM: 1,
			yawRadians: 0,
		},
	],
	walls: [],
};

const chairResource: CustomGlbResource = {
	bytes: new Uint8Array([1, 2, 3]),
	resourceHash: "chair-hash",
};

describe("CustomGlbRuntimeCache", () => {
	it("passes an exact immutable byte view to GLTFLoader without another full copy", () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const embedded = new Uint8Array(new ArrayBuffer(8), 2, 3);

		expect(arrayBufferForGlbParse(bytes)).toBe(bytes.buffer);
		expect(arrayBufferForGlbParse(embedded)).not.toBe(embedded.buffer);
	});

	it("deduplicates an in-flight and resolved GLB parse by immutable resource hash", async () => {
		let parseCount = 0;
		const root = { kind: "parsed-root" };
		const cache = new CustomGlbRuntimeCache<typeof root>();
		const parse = async () => {
			parseCount += 1;
			return root;
		};

		const [first, second] = await Promise.all([
			cache.load("first-definition", chairResource, parse),
			cache.load("second-definition", chairResource, parse),
		]);
		const later = await cache.load("third-definition", chairResource, parse);

		expect(parseCount).toBe(1);
		expect(first).toEqual({ assetDefinitionId: "first-definition", root });
		expect(second).toEqual({ assetDefinitionId: "second-definition", root });
		expect(later).toEqual({ assetDefinitionId: "third-definition", root });
	});

	it("releases each retained parsed root when its renderer unmounts", async () => {
		const root = { kind: "parsed-root" };
		const cache = new CustomGlbRuntimeCache<typeof root>();
		await cache.load("chair-definition", chairResource, async () => root);
		const disposed: (typeof root)[] = [];

		await cache.dispose((candidate) => disposed.push(candidate));

		expect(disposed).toEqual([root]);
	});

	it("releases a decoded root as soon as its immutable resource leaves the active scene", async () => {
		const root = { kind: "parsed-root" };
		const cache = new CustomGlbRuntimeCache<typeof root>();
		await cache.load("chair-definition", chairResource, async () => root);
		const disposed: (typeof root)[] = [];

		await cache.evictExcept(new Set(), (candidate) => disposed.push(candidate));

		expect(disposed).toEqual([root]);
	});

	it("keeps the renderer structure stable for a pose-only item change", () => {
		const moved: RectangularRoomWebGlScene = {
			...scene,
			items: [
				{ ...scene.items[0], centerXM: 3.2, centerZM: 2.1, yawRadians: 1.2 },
			],
		};

		expect(rendererStructureKeyFor(scene)).toBe(rendererStructureKeyFor(moved));
		expect(
			rendererStructureKeyFor({
				...scene,
				items: [
					...scene.items,
					{ ...scene.items[0], assetInstanceId: "second-instance" },
				],
			}),
		).not.toBe(rendererStructureKeyFor(scene));
	});
});

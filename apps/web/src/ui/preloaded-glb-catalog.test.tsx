import { describe, expect, it } from "@rstest/core";

import {
	catalogAssetsFromPublication,
	catalogSections,
	filterPreloadedGlbCatalogAssets,
	preloadedGlbCatalogAssets,
} from "./preloaded-glb-catalog";

const hash = (digit: string) => digit.repeat(64);

describe("preloaded GLB catalog", () => {
	it("replaces procedural defaults with the curated furniture resources", () => {
		expect(preloadedGlbCatalogAssets.map((asset) => asset.id)).toEqual([
			"antique-sofa",
			"dining-armchair",
			"ruined-chair",
			"single-bed",
			"scandinavian-closet",
		]);
		expect(
			preloadedGlbCatalogAssets.every(
				(asset) =>
					asset.resourceUrl.startsWith("/catalog/") &&
					asset.thumbnailUrl.startsWith("/catalog/") &&
					asset.widthMm > 0 &&
					asset.depthMm > 0 &&
					asset.heightMm > 0,
			),
		).toBe(true);
	});

	it("filters the built-in collection locally by category and search query", () => {
		expect(catalogSections.map((section) => section.label)).toEqual([
			"Мебель",
			"Сантехника",
			"Техника и электроника",
			"Освещение",
			"Аксессуары",
		]);
		expect(
			filterPreloadedGlbCatalogAssets(preloadedGlbCatalogAssets, {
				section: "furniture",
				query: "",
			}),
		).toHaveLength(preloadedGlbCatalogAssets.length);
		expect(
			filterPreloadedGlbCatalogAssets(preloadedGlbCatalogAssets, {
				section: "plumbing",
				query: "",
			}),
		).toEqual([]);
		expect(
			filterPreloadedGlbCatalogAssets(preloadedGlbCatalogAssets, {
				section: "all",
				query: "винтаж",
			}).map((asset) => asset.id),
		).toEqual([]);
		expect(
			filterPreloadedGlbCatalogAssets(preloadedGlbCatalogAssets, {
				section: "all",
				query: "хранение",
			}).map((asset) => asset.id),
		).toEqual(["scandinavian-closet"]);
		expect(
			filterPreloadedGlbCatalogAssets(preloadedGlbCatalogAssets, {
				section: "all",
				query: "напольный",
			}),
		).toHaveLength(preloadedGlbCatalogAssets.length);
		expect(
			filterPreloadedGlbCatalogAssets(preloadedGlbCatalogAssets, {
				section: "all",
				query: "мебель",
			}),
		).toHaveLength(preloadedGlbCatalogAssets.length);
	});

	it("projects an exact versioned publication into hash-addressed cards", () => {
		const publication: Parameters<typeof catalogAssetsFromPublication>[0] = {
			assets: [
				{
					anchorClass: "floor",
					assetId: "remote-bed",
					category: "sleep",
					dimensionsMm: { depth: 1000, height: 500, width: 2000 },
					frontDirection: "positive-z",
					label: "Удалённая кровать",
					resource: {
						byteLength: 4,
						mediaType: "model/gltf-binary",
						sha256: hash("a"),
					},
					section: "furniture",
					thumbnail: {
						byteLength: 3,
						mediaType: "image/png",
						sha256: hash("b"),
					},
					variantSlots: [],
				},
			],
			catalogVersion: "alpha-1",
			envelopeHash: hash("c"),
			publishedAt: "2026-08-26T20:00:00Z",
		};
		const assets = catalogAssetsFromPublication({
			...publication,
			assets: ["kursi-armchair", "wooden-cabinet", "zen-dining-chair"]
				.flatMap((assetId) =>
					publication.assets.map((asset) => ({ ...asset, assetId })),
				)
				.concat(publication.assets),
		});

		expect(assets).toEqual([
			{
				anchorClass: "floor",
				catalogAssetId: "remote-bed",
				catalogEnvelopeHash: hash("c"),
				catalogVersion: "alpha-1",
				category: "sleep",
				depthMm: 1000,
				heightMm: 500,
				id: "remote-bed",
				label: "Удалённая кровать",
				resource: {
					byteLength: 4,
					mediaType: "model/gltf-binary",
					sha256: hash("a"),
				},
				resourceUrl: `/catalog-api/v1/resources/sha256/${hash("a")}`,
				section: "furniture",
				thumbnail: {
					byteLength: 3,
					mediaType: "image/png",
					sha256: hash("b"),
				},
				thumbnailUrl: `/catalog-api/v1/resources/sha256/${hash("b")}`,
				variantCount: 0,
				widthMm: 2000,
			},
		]);
	});
});

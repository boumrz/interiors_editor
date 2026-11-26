import { describe, expect, it } from "@rstest/core";

import { configureRectangularRoom } from "./rectangular-room";
import {
	createCustomGlbFloorItem,
	createCustomGlbWallItem,
	validateCustomGlbAssetDefinition,
} from "./custom-glb-asset";
import { createInitialProject } from "./initial-project";
import type { CustomGlbAssetDefinition } from "./project";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `generated-${index}` };
}

function roomProject() {
	const initial = createInitialProject({
		createdAt: "2026-08-15T20:20:00.000Z",
		levelId: "level-1",
		name: "Custom asset room",
		projectId: "project-1",
	});
	const configured = configureRectangularRoom(
		initial,
		{ depthMm: "4000", heightMm: "2600", widthMm: "5000" },
		ids(
			"vertex-a",
			"vertex-b",
			"vertex-c",
			"vertex-d",
			"wall-a",
			"wall-b",
			"wall-c",
			"wall-d",
			"room-1",
		),
		"2026-08-15T20:21:00.000Z",
	);
	if (configured.kind !== "accepted") throw new Error("Expected fixture room");
	return configured.project;
}

const customAsset: CustomGlbAssetDefinition = {
	assetDefinitionId: "custom-sofa",
	byteLength: 2_100_000,
	depthMm: 920,
	displayName: "Мой диван",
	format: "glb" as const,
	heightMm: 820,
	resourceHash: "a".repeat(64),
	widthMm: 2200,
};

describe("createCustomGlbFloorItem", () => {
	it("retains a registered mixed-case resource address without relaxing the custom byte limit or catalog-envelope grammar", () => {
		const resourceHash = "aB".repeat(32);
		expect(
			validateCustomGlbAssetDefinition({ ...customAsset, resourceHash }),
		).toEqual({ kind: "accepted" });
		expect(
			validateCustomGlbAssetDefinition({
				...customAsset,
				resourceHash,
				byteLength: 25 * 1024 * 1024 + 1,
			}).kind,
		).toBe("rejected");
		expect(
			validateCustomGlbAssetDefinition({
				...customAsset,
				resourceHash,
				source: "CatalogVersion",
				catalogAssetId: "asset",
				catalogVersion: "v1",
				catalogEnvelopeHash: "A".repeat(64),
			}).kind,
		).toBe("rejected");
	});
	it("rejects malformed model metadata before allocating its first rotated instance", () => {
		const project = roomProject();
		expect(
			createCustomGlbFloorItem(
				project,
				{
					asset: { ...customAsset, byteLength: 0 },
					color: "#716796",
					roomId: "room-1",
					xMm: 2200,
					zMm: 1800,
					yawStep: 2,
				},
				{
					next: () => {
						throw new Error("Invalid metadata must not allocate an instance");
					},
				},
				project.updatedAt,
			),
		).toEqual({
			kind: "rejected",
			reasonCode: "INVALID_CUSTOM_ASSET_DEFINITION",
		});
		expect(project.assetDefinitionRefs).toEqual([]);
	});
	it("registers a different model even when an unrelated custom definition already exists", () => {
		const project = roomProject();
		const first = createCustomGlbFloorItem(
			project,
			{
				asset: customAsset,
				color: "#716796",
				roomId: "room-1",
				xMm: 2200,
				zMm: 1800,
			},
			ids("first"),
			project.updatedAt,
		);
		if (first.kind !== "accepted") throw new Error("Expected first model");
		const secondAsset = { ...customAsset, assetDefinitionId: "another-model" };
		const second = createCustomGlbFloorItem(
			first.project,
			{
				asset: secondAsset,
				color: "#716796",
				roomId: "room-1",
				xMm: 2200,
				zMm: 1800,
				yawStep: 2,
			},
			ids("second"),
			project.updatedAt,
		);
		expect(second.kind).toBe("accepted");
		if (second.kind !== "accepted")
			throw new Error("Expected independent rotated model");
		expect(second.project.assetDefinitionRefs).toEqual([
			customAsset,
			secondAsset,
		]);
		expect(second.project.assetInstances).toHaveLength(2);
		expect(second.project.assetInstances[1]).toMatchObject({
			yawStep: 2,
			assetDefinitionId: "another-model",
		});
	});
	it("keeps the initial rotated pose when registering a GLB and its first instance atomically", () => {
		const project = roomProject();
		const result = createCustomGlbFloorItem(
			project,
			{
				asset: customAsset,
				color: "#716796",
				roomId: "room-1",
				xMm: 2200,
				zMm: 1800,
				yawStep: 2,
			},
			ids("rotated-instance"),
			project.updatedAt,
		);
		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted")
			throw new Error("Expected rotated custom model");
		expect(result.project.assetInstances[0]).toMatchObject({
			assetDefinitionId: customAsset.assetDefinitionId,
			yawStep: 2,
		});
		expect(result.project.assetDefinitionRefs).toEqual([customAsset]);
	});
	it("adds a declared custom GLB definition and a host-addressed floor instance in one project transition", () => {
		const result = createCustomGlbFloorItem(
			roomProject(),
			{
				asset: customAsset,
				color: "#716796",
				roomId: "room-1",
				xMm: 2200,
				zMm: 1800,
			},
			ids("instance-sofa"),
			"2026-08-15T20:22:00.000Z",
		);

		expect(result).toEqual({
			kind: "accepted",
			project: expect.objectContaining({
				assetDefinitionRefs: [customAsset],
				assetInstances: [
					expect.objectContaining({
						assetDefinitionId: "custom-sofa",
						assetInstanceId: "instance-sofa",
						depthMm: 920,
						heightMm: 820,
						label: "Мой диван",
						roomId: "room-1",
						widthMm: 2200,
						xMm: 2200,
						zMm: 1800,
					}),
				],
				updatedAt: "2026-08-15T20:22:00.000Z",
			}),
		});
	});

	it("registers a custom floor instance only in its selected room layout", () => {
		const project = roomProject();
		const result = createCustomGlbFloorItem({
			...project,
			roomLayouts: [
				{ roomId: "room-1", layoutId: "layout-a", slot: "A", name: "A" },
				{ roomId: "room-1", layoutId: "layout-b", slot: "B", name: "B" },
			],
		}, { asset: customAsset, color: "#716796", roomId: "room-1", xMm: 2200, zMm: 1800, roomLayoutId: "layout-b" },
		ids("instance-sofa"), project.updatedAt);
		expect(result).toMatchObject({
			kind: "accepted",
			project: {
				assetInstances: [{ assetInstanceId: "instance-sofa", roomLayoutId: "layout-b" }],
				assetDefinitionRefs: [customAsset],
			},
		});
	});

	it("keeps a custom definition immutable instead of silently replacing a same-id asset", () => {
		const first = createCustomGlbFloorItem(
			roomProject(),
			{
				asset: customAsset,
				color: "#716796",
				roomId: "room-1",
				xMm: 2200,
				zMm: 1800,
			},
			ids("instance-sofa"),
			"2026-08-15T20:22:00.000Z",
		);
		if (first.kind !== "accepted")
			throw new Error("Expected first custom asset");

		expect(
			createCustomGlbFloorItem(
				first.project,
				{
					asset: { ...customAsset, widthMm: 2300 },
					color: "#716796",
					roomId: "room-1",
					xMm: 3400,
					zMm: 1800,
				},
				ids("instance-other"),
				"2026-08-15T20:23:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "CUSTOM_ASSET_ID_CONFLICT" });
	});

	it("does not register custom metadata when its requested placement is not usable", () => {
		expect(
			createCustomGlbFloorItem(
				roomProject(),
				{
					asset: customAsset,
					color: "#716796",
					roomId: "room-1",
					xMm: 100,
					zMm: 100,
				},
				ids("instance-sofa"),
				"2026-08-15T20:22:00.000Z",
			),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
	});

	it("accepts technical custom-GLB metadata without a legal usage declaration", () => {
		expect(validateCustomGlbAssetDefinition(customAsset)).toEqual({
			kind: "accepted",
		});
	});

	it("requires a complete immutable catalog version identity when a GLB claims catalog provenance", () => {
		const catalogAsset = {
			...customAsset,
			catalogAssetId: "walnut-table",
			catalogEnvelopeHash: "b".repeat(64),
			catalogVersion: "alpha-2026-08-30",
			source: "CatalogVersion",
		};

		for (const incompleteCatalogAsset of [
			{ ...catalogAsset, catalogEnvelopeHash: undefined },
			{ ...catalogAsset, catalogAssetId: "" },
			{ ...catalogAsset, catalogAssetId: " walnut-table " },
			{ ...catalogAsset, catalogVersion: "" },
			{ ...catalogAsset, catalogVersion: " alpha-2026-08-30 " },
			{ ...catalogAsset, catalogEnvelopeHash: "b".repeat(63) },
			{ ...catalogAsset, source: "CustomAssetId" },
		]) {
			expect(
				validateCustomGlbAssetDefinition(
					incompleteCatalogAsset as unknown as CustomGlbAssetDefinition,
				),
			).toEqual({
				kind: "rejected",
				reasonCode: "INVALID_CUSTOM_ASSET_DEFINITION",
			});
		}
	});

	it("accepts one exact catalog origin but rejects type-confused and weakly bounded identity fields", () => {
		const catalogAsset = {
			...customAsset,
			catalogAssetId: "walnut-table",
			catalogEnvelopeHash: "b".repeat(64),
			catalogVersion: "alpha-2026-08-30",
			source: "CatalogVersion" as const,
		};
		const catalogAssetIdImposter = {
			length: "walnut-table".length,
			trim: () => catalogAssetIdImposter,
		};
		const catalogVersionImposter = {
			length: "alpha-2026-08-30".length,
			trim: () => catalogVersionImposter,
		};
		const catalogEnvelopeHashImposter = {
			toString: () => "b".repeat(64),
		};

		expect(validateCustomGlbAssetDefinition(catalogAsset)).toEqual({
			kind: "accepted",
		});

		for (const malformedCatalogAsset of [
			{ ...catalogAsset, catalogAssetId: catalogAssetIdImposter },
			{ ...catalogAsset, catalogVersion: catalogVersionImposter },
			{ ...catalogAsset, catalogEnvelopeHash: catalogEnvelopeHashImposter },
			{ ...catalogAsset, catalogEnvelopeHash: `x${"b".repeat(64)}` },
			{ ...catalogAsset, catalogEnvelopeHash: `${"b".repeat(64)}x` },
			{ ...catalogAsset, catalogEnvelopeHash: "b" },
			{ ...catalogAsset, catalogEnvelopeHash: "z".repeat(64) },
		]) {
			expect(
				validateCustomGlbAssetDefinition(
					malformedCatalogAsset as unknown as CustomGlbAssetDefinition,
				),
			).toEqual({
				kind: "rejected",
				reasonCode: "INVALID_CUSTOM_ASSET_DEFINITION",
			});
		}
	});

	it("rejects malformed technical metadata before a custom GLB can become durable", () => {
		for (const asset of [
			{ ...customAsset, format: "gltf" },
			{ ...customAsset, resourceHash: "not-a-sha-256" },
			{ ...customAsset, byteLength: 0 },
			{ ...customAsset, widthMm: 0 },
		]) {
			expect(
				validateCustomGlbAssetDefinition(asset as CustomGlbAssetDefinition),
			).toEqual({
				kind: "rejected",
				reasonCode: "INVALID_CUSTOM_ASSET_DEFINITION",
			});
		}
	});
});

describe("catalog GLB wall host preservation", () => {
	it("rejects invalid model metadata before allocating a wall instance or retaining its definition", () => {
		const base = roomProject();
		const allocations: string[] = [];
		const result = createCustomGlbWallItem(
			base,
			{
				asset: {
					...customAsset,
					resourceHash: "not-a-resource-hash",
					widthMm: 220,
					depthMm: 190,
					heightMm: 280,
				},
				color: "#716796",
				wallSegmentId: "wall-a",
				side: "left",
				offsetMm: 1000,
				elevationMm: 1500,
			},
			{
				next: () => {
					allocations.push("allocated");
					return "unexpected";
				},
			},
			"2026-10-24T12:00:00.000Z",
		);

		expect(result).toEqual({
			kind: "rejected",
			reasonCode: "INVALID_CUSTOM_ASSET_DEFINITION",
		});
		expect(allocations).toEqual([]);
		expect(base.assetDefinitionRefs).toEqual([]);
		expect(base.assetInstances).toEqual([]);
	});

	it("rejects a duplicate definition identity without replacing the original or allocating an instance", () => {
		const base = { ...roomProject(), assetDefinitionRefs: [customAsset] };
		const allocations: string[] = [];
		const result = createCustomGlbWallItem(
			base,
			{
				asset: customAsset,
				color: "#716796",
				wallSegmentId: "wall-a",
				side: "left",
				offsetMm: 1500,
				elevationMm: 1000,
			},
			{
				next: () => {
					allocations.push("allocated");
					return "unexpected";
				},
			},
			"2026-10-24T12:00:00.000Z",
		);

		expect(result).toEqual({
			kind: "rejected",
			reasonCode: "CUSTOM_ASSET_ID_CONFLICT",
		});
		expect(allocations).toEqual([]);
		expect(base.assetDefinitionRefs).toEqual([customAsset]);
		expect(base.assetInstances).toEqual([]);
	});

	it("retains unrelated definitions when adding a different model to its wall host", () => {
		const base = { ...roomProject(), assetDefinitionRefs: [customAsset] };
		const sconce = {
			...customAsset,
			assetDefinitionId: "catalog-sconce",
			widthMm: 220,
			depthMm: 190,
			heightMm: 280,
		};
		const result = createCustomGlbWallItem(
			base,
			{
				asset: sconce,
				color: "#716796",
				wallSegmentId: "wall-a",
				side: "left",
				offsetMm: 1000,
				elevationMm: 1500,
			},
			ids("wall-sconce-instance"),
			"2026-10-24T12:00:00.000Z",
		);

		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted")
			throw new Error("Expected a distinct wall model definition");
		expect(result.project.assetDefinitionRefs).toEqual([customAsset, sconce]);
		expect(result.project.assetInstances).toEqual([
			expect.objectContaining({
				assetDefinitionId: "catalog-sconce",
				anchorClass: "wall",
				wallSegmentId: "wall-a",
			}),
		]);
		expect(base.assetDefinitionRefs).toEqual([customAsset]);
	});

	it("registers the exact definition with a wall-local instance instead of falling back to the floor", () => {
		const base = roomProject();
		const result = createCustomGlbWallItem(
			base,
			{
				asset: {
					...customAsset,
					assetDefinitionId: "catalog-sconce",
					widthMm: 220,
					depthMm: 190,
					heightMm: 280,
				},
				color: "#716796",
				wallSegmentId: "wall-a",
				side: "left",
				offsetMm: 1000,
				elevationMm: 1500,
			},
			ids("wall-sconce-instance"),
			"2026-10-24T12:00:00.000Z",
		);
		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted")
			throw new Error("Expected wall-mounted GLB");
		expect(result.project.assetInstances).toEqual([
			expect.objectContaining({
				anchorClass: "wall",
				assetInstanceId: "wall-sconce-instance",
				assetDefinitionId: "catalog-sconce",
				wallSegmentId: "wall-a",
				side: "left",
				offsetMm: 1000,
				elevationMm: 1500,
			}),
		]);
		expect(result.project.assetDefinitionRefs[0]?.resourceHash).toBe(
			customAsset.resourceHash,
		);
		expect(base.assetInstances).toEqual([]);
	});
	it("rejects a missing or undersized host without allocating an instance or retaining a definition", () => {
		for (const address of [
			{ wallSegmentId: "missing", offsetMm: 1000 },
			{ wallSegmentId: "wall-a", offsetMm: 100000 },
		]) {
			const base = roomProject();
			const allocated: string[] = [];
			const result = createCustomGlbWallItem(
				base,
				{
					asset: customAsset,
					color: "#716796",
					side: "left",
					elevationMm: 100,
					...address,
				},
				{
					next: () => {
						allocated.push("allocated");
						return "unexpected";
					},
				},
				"2026-10-24T12:00:00.000Z",
			);
			expect(result.kind).toBe("rejected");
			expect(allocated).toEqual([]);
			expect(base.assetDefinitionRefs).toEqual([]);
		}
	});
});

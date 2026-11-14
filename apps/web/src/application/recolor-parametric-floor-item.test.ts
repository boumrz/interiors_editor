import { describe, expect, it } from "@rstest/core";

import { canonicalProjectSerializer } from "./create-project";
import { RecolorParametricFloorItemUseCase } from "./recolor-parametric-floor-item";
import type { PublicationCandidate } from "./ports";
import { createCustomGlbFloorItem } from "../domain/custom-glb-asset";
import { createInitialProject } from "../domain/initial-project";
import { createParametricFloorItem } from "../domain/parametric-item";
import { configureRectangularRoom } from "../domain/rectangular-room";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithItem(assetDefinitionId?: string): PublicationCandidate {
	const room = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-15T18:00:00.000Z",
			levelId: "level-1",
			name: "Цветовой тест",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids("v-1", "v-2", "v-3", "v-4", "wall-1", "wall-2", "wall-3", "wall-4", "room-1"),
		"2026-08-15T18:01:00.000Z",
	);
	if (room.kind !== "accepted") throw new Error("Expected room fixture");
	const item =
		assetDefinitionId === undefined
			? createParametricFloorItem(
					room.project,
					{
						color: "#a76a3b",
						depthMm: 700,
						heightMm: 750,
						label: "Стол",
						roomId: "room-1",
						widthMm: 1200,
						xMm: 1500,
						zMm: 1500,
					},
					ids("item-1"),
					"2026-08-15T18:02:00.000Z",
				)
			: createCustomGlbFloorItem(
					room.project,
					{
						asset: {
							assetDefinitionId,
							byteLength: 1024,
							depthMm: 700,
							displayName: "GLB-стол",
							format: "glb",
							heightMm: 750,
							resourceHash:
								"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
							widthMm: 1200,
						},
						color: "#a76a3b",
						roomId: "room-1",
						xMm: 1500,
						zMm: 1500,
					},
					ids("item-1"),
					"2026-08-15T18:02:00.000Z",
				);
	if (item.kind !== "accepted") throw new Error("Expected item fixture");
	return {
		project: item.project,
		revision: {
			checksum: "sum:base",
			createdAt: item.project.updatedAt,
			projectId: item.project.projectId,
			revisionId: "revision-1",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(item.project),
		},
	};
}

describe("RecolorParametricFloorItemUseCase", () => {
	it("publishes one durable revision for a declared color variant", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: unknown[] = [];
		const useCase = new RecolorParametricFloorItemUseCase({
			checksum: { sha256: async () => "sum:recolored" },
			clock: { now: () => "2026-08-15T18:03:00.000Z" },
			ids: ids("revision-2"),
			repository: {
				publishNextRevision: async (candidate, expectedBaseRevisionId) => {
					expect(expectedBaseRevisionId).toBe("revision-1");
					published.push(candidate);
					return { kind: "durable" };
				},
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithItem(),
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				(status) => statuses.push(status),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(published).toEqual([
			expect.objectContaining({
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							color: "#416b91",
							colorVariantId: "alpha-blue",
						}),
					],
				}),
				revision: expect.objectContaining({ checksum: "sum:recolored" }),
			}),
		]);
		expect(statuses).toEqual([
			{ kind: "saving" },
			expect.objectContaining({ kind: "saved" }),
		]);
	});

	it("rejects a floor-item variant when its preview base is no longer current", async () => {
		const expectedBaseRevisionIds: string[] = [];
		const statuses: string[] = [];
		const repository = {
			loadCurrent: async () => ({ kind: "empty" as const }),
			publish: async () => ({ kind: "durable" as const }),
			publishNextRevision: async (
				_candidate: import("./ports").DurablePublicationCandidate,
				expectedBaseRevisionId: string,
			) => {
				expectedBaseRevisionIds.push(expectedBaseRevisionId);
				return { kind: "stale-base" as const };
			},
			recover: async () => ({ kind: "recovered" as const }),
		};
		const useCase = new RecolorParametricFloorItemUseCase({
			checksum: { sha256: async () => "sum:recolored" },
			clock: { now: () => "2026-08-15T18:03:00.000Z" },
			ids: ids("revision-2"),
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithItem(),
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(expectedBaseRevisionIds).toEqual(["revision-1"]);
		expect(statuses).toEqual(["saving", "stale-base"]);
	});

	it("keeps a persistence failure non-durable and exposes its candidate status", async () => {
		const statuses: import("./recolor-parametric-floor-item").RecolorParametricFloorItemStatus[] =
			[];
		const useCase = new RecolorParametricFloorItemUseCase({
			checksum: { sha256: async () => "sum:recolored" },
			clock: { now: () => "2026-08-15T18:03:00.000Z" },
			ids: ids("revision-2"),
			repository: {
				publishNextRevision: async () => ({
					kind: "persist-failed" as const,
					reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
				}),
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithItem(),
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				(status) => statuses.push(status),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(statuses).toEqual([
			{ kind: "saving" },
			{
				candidate: expect.objectContaining({
					project: expect.objectContaining({
						assetInstances: [
							expect.objectContaining({
								assetInstanceId: "item-1",
								colorVariantId: "alpha-blue",
							}),
						],
					}),
				}),
				kind: "persist-failed",
				reasonCode: "PERSISTENCE_WRITE_FAILED",
			},
		]);
	});

	it("does not hash or publish a color that was not declared by the local catalog", async () => {
		let published = 0;
		const useCase = new RecolorParametricFloorItemUseCase({
			checksum: { sha256: async () => "must-not-hash" },
			clock: { now: () => "2026-08-15T18:03:00.000Z" },
			ids: ids("must-not-allocate"),
			repository: {
				publishNextRevision: async () => {
					published += 1;
					return { kind: "durable" as const };
				},
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithItem(),
				{ assetInstanceId: "item-1", variantId: "unknown" as never },
				() => undefined,
			),
		).resolves.toEqual({ kind: "rejected", reasonCode: "ITEM_COLOR_UNSUPPORTED" });
		expect(published).toBe(0);
	});

	it("does not hash or publish a GLB-backed item without a declared color slot", async () => {
		let published = 0;
		const useCase = new RecolorParametricFloorItemUseCase({
			checksum: { sha256: async () => "must-not-hash" },
			clock: { now: () => "2026-08-25T14:30:00.000Z" },
			ids: ids("must-not-allocate"),
			repository: {
				publishNextRevision: async () => {
					published += 1;
					return { kind: "durable" as const };
				},
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithItem("model-1"),
				{ assetInstanceId: "item-1", variantId: "alpha-blue" },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "ITEM_COLOR_NOT_SUPPORTED",
		});
		expect(published).toBe(0);
	});
});

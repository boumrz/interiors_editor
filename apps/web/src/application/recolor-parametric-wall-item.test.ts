import { describe, expect, it } from "@rstest/core";

import { canonicalProjectSerializer } from "./create-project";
import { RecolorParametricWallItemUseCase } from "./recolor-parametric-wall-item";
import type { PublicationCandidate } from "./ports";
import { createInitialProject } from "../domain/initial-project";
import { createParametricWallItem } from "../domain/parametric-wall-item";
import { configureRectangularRoom } from "../domain/rectangular-room";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithPanel(assetDefinitionId?: string): PublicationCandidate {
	const room = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-25T14:20:00.000Z",
			levelId: "level-1",
			name: "Цвет настенной панели",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids("v-1", "v-2", "v-3", "v-4", "wall-1", "wall-2", "wall-3", "wall-4", "room-1"),
		"2026-08-25T14:21:00.000Z",
	);
	if (room.kind !== "accepted") throw new Error("Expected room fixture");
	const project =
		assetDefinitionId === undefined
			? room.project
			: {
					...room.project,
					assetDefinitionRefs: [
						{
							assetDefinitionId,
							byteLength: 1024,
							depthMm: 50,
							displayName: "GLB-панель",
							format: "glb" as const,
							heightMm: 600,
							resourceHash:
								"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
							widthMm: 900,
						},
					],
				};
	const panel = createParametricWallItem(
		project,
		{
			...(assetDefinitionId === undefined ? {} : { assetDefinitionId }),
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Настенная панель",
			offsetMm: 2050,
			side: "left",
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		ids("panel-1"),
		"2026-08-25T14:22:00.000Z",
	);
	if (panel.kind !== "accepted") throw new Error("Expected panel fixture");
	return {
		project: panel.project,
		revision: {
			checksum: "sum:base",
			createdAt: panel.project.updatedAt,
			projectId: panel.project.projectId,
			revisionId: "revision-1",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(panel.project),
		},
	};
}

describe("RecolorParametricWallItemUseCase", () => {
	it("publishes precisely one durable revision for a declared wall-panel color", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const useCase = new RecolorParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:recolored" },
			clock: { now: () => "2026-08-25T14:23:00.000Z" },
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
				candidateWithPanel(),
				{ assetInstanceId: "panel-1", variantId: "alpha-warm-wood" },
				(status) => statuses.push(status.kind),
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
							color: "#a76a3b",
							colorVariantId: "alpha-warm-wood",
						}),
					],
				}),
				revision: expect.objectContaining({ checksum: "sum:recolored" }),
			}),
		]);
		expect(statuses).toEqual(["saving", "saved"]);
	});

	it("rejects a wall-item variant when its preview base is no longer current", async () => {
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
		const useCase = new RecolorParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:recolored" },
			clock: { now: () => "2026-08-25T14:23:00.000Z" },
			ids: ids("revision-2"),
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithPanel(),
				{ assetInstanceId: "panel-1", variantId: "alpha-warm-wood" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(expectedBaseRevisionIds).toEqual(["revision-1"]);
		expect(statuses).toEqual(["saving", "stale-base"]);
	});

	it("does not hash or publish an unsupported wall-panel color", async () => {
		let published = 0;
		const useCase = new RecolorParametricWallItemUseCase({
			checksum: { sha256: async () => "must-not-hash" },
			clock: { now: () => "2026-08-25T14:23:00.000Z" },
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
				candidateWithPanel(),
				{ assetInstanceId: "panel-1", variantId: "unknown" as never },
				() => undefined,
			),
		).resolves.toEqual({ kind: "rejected", reasonCode: "ITEM_COLOR_UNSUPPORTED" });
		expect(published).toBe(0);
	});

	it("reports a persistence failure without claiming that the panel color is durable", async () => {
		const statuses: string[] = [];
		const useCase = new RecolorParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:recolored" },
			clock: { now: () => "2026-08-25T14:23:00.000Z" },
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
				candidateWithPanel(),
				{ assetInstanceId: "panel-1", variantId: "alpha-warm-wood" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(statuses).toEqual(["saving", "persist-failed"]);
	});

	it("does not hash or publish a model-backed wall item without a declared color slot", async () => {
		let published = 0;
		const useCase = new RecolorParametricWallItemUseCase({
			checksum: { sha256: async () => "must-not-hash" },
			clock: { now: () => "2026-08-25T14:31:00.000Z" },
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
				candidateWithPanel("model-1"),
				{ assetInstanceId: "panel-1", variantId: "alpha-warm-wood" },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "ITEM_COLOR_NOT_SUPPORTED",
		});
		expect(published).toBe(0);
	});
});

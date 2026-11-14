import { describe, expect, it } from "@rstest/core";

import { createParametricWallItem } from "../domain/parametric-wall-item";
import { createInitialProject } from "../domain/initial-project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { canonicalProjectSerializer } from "./create-project";
import { MoveParametricWallItemUseCase } from "./move-parametric-wall-item";
import type { PublicationCandidate } from "./ports";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithWallItem(): PublicationCandidate {
	const room = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-24T01:00:00.000Z",
			levelId: "level-1",
			name: "Квартира",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids("v-1", "v-2", "v-3", "v-4", "wall-1", "wall-2", "wall-3", "wall-4", "room-1"),
		"2026-08-24T01:01:00.000Z",
	);
	if (room.kind !== "accepted") throw new Error("Expected room fixture");
	const item = createParametricWallItem(
		room.project,
		{
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
		"2026-08-24T01:02:00.000Z",
	);
	if (item.kind !== "accepted") throw new Error("Expected panel fixture");
	return {
		project: item.project,
		revision: {
			checksum: "base",
			createdAt: item.project.updatedAt,
			projectId: "project-1",
			revisionId: "revision-1",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(item.project),
		},
	};
}

describe("MoveParametricWallItemUseCase", () => {
	it("publishes a new revision only for a valid local wall-item move", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const useCase = new MoveParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:moved" },
			clock: { now: () => "2026-08-24T01:03:00.000Z" },
			ids: ids("revision-2"),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" };
				},
				recover: async () => ({ kind: "recovered" }),
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithWallItem(),
				{ assetInstanceId: "panel-1", elevationMm: 2100, offsetMm: 3100 },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(published).toHaveLength(1);
		expect(statuses).toEqual(["saving", "saved"]);
		expect(published[0]?.project.assetInstances).toEqual([
			expect.objectContaining({
			assetInstanceId: "panel-1",
			elevationMm: 2100,
			offsetMm: 3100,
		}),
		]);
	});

	it("does not serialize or publish an out-of-bounds wall-local move", async () => {
		let hashed = 0;
		let published = 0;
		const useCase = new MoveParametricWallItemUseCase({
			checksum: {
				sha256: async () => {
					hashed += 1;
					return "must-not-hash";
				},
			},
			clock: { now: () => "2026-08-24T01:03:00.000Z" },
			ids: ids("must-not-allocate"),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => {
					published += 1;
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithWallItem(),
				{ assetInstanceId: "panel-1", elevationMm: 1300, offsetMm: 449 },
				() => undefined,
			),
		).resolves.toEqual({ kind: "rejected", reasonCode: "OUTSIDE_WALL_HOST" });
		expect(hashed).toBe(0);
		expect(published).toBe(0);
	});

	it("reports a persistence failure without claiming the wall move is durable", async () => {
		const statuses: string[] = [];
		const useCase = new MoveParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:moved" },
			clock: { now: () => "2026-08-24T01:03:00.000Z" },
			ids: ids("revision-2"),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({
					kind: "persist-failed" as const,
					reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
				}),
				recover: async () => ({ kind: "recovered" }),
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithWallItem(),
				{ assetInstanceId: "panel-1", elevationMm: 2100, offsetMm: 3100 },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(statuses).toEqual(["saving", "persist-failed"]);
	});
});

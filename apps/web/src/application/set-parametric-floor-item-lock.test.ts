import { describe, expect, it } from "@rstest/core";

import { createInitialProject } from "../domain/initial-project";
import { createParametricFloorItem } from "../domain/parametric-item";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { canonicalProjectSerializer } from "./create-project";
import type { PublicationCandidate } from "./ports";
import { SetParametricFloorItemLockUseCase } from "./set-parametric-floor-item-lock";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithFloorItem(): PublicationCandidate {
	const room = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-25T01:10:00.000Z",
			levelId: "level-1",
			name: "Квартира",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids("v-1", "v-2", "v-3", "v-4", "wall-1", "wall-2", "wall-3", "wall-4", "room-1"),
		"2026-08-25T01:11:00.000Z",
	);
	if (room.kind !== "accepted") throw new Error("Expected room fixture");
	const item = createParametricFloorItem(
		room.project,
		{
			color: "#2f80ed",
			depthMm: 600,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 900,
			xMm: 1800,
			zMm: 1500,
		},
		ids("item-1"),
		"2026-08-25T01:12:00.000Z",
	);
	if (item.kind !== "accepted") throw new Error("Expected floor-item fixture");
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

describe("SetParametricFloorItemLockUseCase", () => {
	it("publishes an explicit floor-item lock as one durable revision", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const useCase = new SetParametricFloorItemLockUseCase({
			checksum: { sha256: async () => "sum:locked" },
			clock: { now: () => "2026-08-25T01:13:00.000Z" },
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
				candidateWithFloorItem(),
				{ assetInstanceId: "item-1", locked: true },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(statuses).toEqual(["saving", "saved"]);
		expect(published).toHaveLength(1);
		expect(published[0]?.project.assetInstances).toEqual([
			expect.objectContaining({ assetInstanceId: "item-1", locked: true }),
		]);
	});

	it("does not hash or publish a no-op floor-item lock command", async () => {
		let hashed = 0;
		let published = 0;
		const useCase = new SetParametricFloorItemLockUseCase({
			checksum: {
				sha256: async () => {
					hashed += 1;
					return "must-not-hash";
				},
			},
			clock: { now: () => "2026-08-25T01:13:00.000Z" },
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
				candidateWithFloorItem(),
				{ assetInstanceId: "item-1", locked: false },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "ITEM_LOCK_STATE_UNCHANGED",
		});
		expect(hashed).toBe(0);
		expect(published).toBe(0);
	});

	it("does not claim a lock durable when its publication fails", async () => {
		const statuses: string[] = [];
		const useCase = new SetParametricFloorItemLockUseCase({
			checksum: { sha256: async () => "sum:locked" },
			clock: { now: () => "2026-08-25T01:13:00.000Z" },
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
				candidateWithFloorItem(),
				{ assetInstanceId: "item-1", locked: true },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(statuses).toEqual(["saving", "persist-failed"]);
	});
});

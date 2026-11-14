import { describe, expect, it } from "@rstest/core";

import { configureRectangularRoom } from "../domain/rectangular-room";
import { createInitialProject } from "../domain/initial-project";
import { addDoorOpeningToProject } from "../domain/door-opening-project";
import { canonicalProjectSerializer } from "./create-project";
import { UpdateRoomPropertiesUseCase } from "./update-room-properties";
import type {
	ChecksumPort,
	ClockPort,
	IdPort,
	ProjectRevisionPublicationPort,
	PublicationCandidate,
} from "./ports";

function baseCandidate(): PublicationCandidate {
	const values = [
		"v-1",
		"v-2",
		"v-3",
		"v-4",
		"wall-1",
		"wall-2",
		"wall-3",
		"wall-4",
		"room-1",
	];
	let index = 0;
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-15T18:00:00.000Z",
			levelId: "level-1",
			name: "План",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		{ next: () => values[index++] ?? `unexpected-${index}` },
		"2026-08-15T18:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected a valid Room fixture");
	}
	return {
		project: configured.project,
		revision: {
			checksum: "sum:base",
			createdAt: configured.project.updatedAt,
			projectId: configured.project.projectId,
			revisionId: "revision-1",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(configured.project),
		},
	};
}

function candidateWithTallDoor(): PublicationCandidate {
	const base = baseCandidate();
	const opened = addDoorOpeningToProject(
		base.project,
		{
			heightMm: 2100,
			offsetMm: 1200,
			sillMm: 0,
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		{ next: () => "door-1" },
		"2026-08-15T18:01:30.000Z",
	);
	if (opened.kind !== "accepted") {
		throw new Error("Expected a valid Door fixture");
	}
	return {
		...base,
		project: opened.project,
		revision: {
			...base.revision,
			createdAt: opened.project.updatedAt,
			serializedProject: canonicalProjectSerializer.serialize(opened.project),
		},
	};
}

const clock: ClockPort = { now: () => "2026-08-15T18:02:00.000Z" };
const checksum: ChecksumPort = { sha256: async () => "sum:next" };

describe("UpdateRoomPropertiesUseCase", () => {
	it("keeps a stale Room-height conflict resolution out of durable history", async () => {
		const expectedBaseRevisionIds: string[] = [];
		let unconditionalPublishes = 0;
		const statuses: string[] = [];
		const repository = {
			loadCurrent: async () => ({ kind: "empty" as const }),
			publish: async () => {
				unconditionalPublishes += 1;
				return { kind: "durable" as const };
			},
			publishNextRevision: async (
				_candidate: PublicationCandidate,
				expectedBaseRevisionId: string,
			) => {
				expectedBaseRevisionIds.push(expectedBaseRevisionId);
				return { kind: "stale-base" as const };
			},
			recover: async () => ({ kind: "recovered" as const }),
		};
		const useCase = new UpdateRoomPropertiesUseCase({
			checksum,
			clock,
			ids: { next: () => "revision-2" },
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.resolveOpeningConflict(
				candidateWithTallDoor(),
				{
					heightMm: 2000,
					name: "Кухня",
					openingResolutions: [
						{ heightMm: 2000, kind: "resize", openingId: "door-1" },
					],
					roomId: "room-1",
					type: "kitchen",
				},
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({ kind: "stale-base", reasonCode: "STALE_BASE_REVISION" });

		expect(expectedBaseRevisionIds).toEqual(["revision-1"]);
		expect(unconditionalPublishes).toBe(0);
		expect(statuses).toEqual(["saving", "stale-base"]);
	});

	it("reports an exact-base persistence failure without saving Room metadata", async () => {
		const statuses: string[] = [];
		const useCase = new UpdateRoomPropertiesUseCase({
			checksum,
			clock,
			ids: { next: () => "revision-2" },
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
				baseCandidate(),
				{ heightMm: 2700, name: "Кухня", roomId: "room-1", type: "kitchen" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({ kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" });

		expect(statuses).toEqual(["saving", "persist-failed"]);
	});

	it("publishes a rechecked Room-height conflict resolution as exactly one revision", async () => {
		const calls: PublicationCandidate[] = [];
		const repository: ProjectRevisionPublicationPort = {
			publishNextRevision: async (candidate) => {
				calls.push(candidate as PublicationCandidate);
				return { kind: "durable" };
			},
		};
		const useCase = new UpdateRoomPropertiesUseCase({
			checksum,
			clock,
			ids: { next: () => "revision-2" },
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.resolveOpeningConflict(
				candidateWithTallDoor(),
				{
					heightMm: 2000,
					name: "Кухня",
					openingResolutions: [
						{ heightMm: 2000, kind: "resize", openingId: "door-1" },
					],
					roomId: "room-1",
					type: "kitchen",
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]?.project).toMatchObject({
			level: {
				openings: [expect.objectContaining({ heightMm: 2000, openingId: "door-1" })],
				rooms: [expect.objectContaining({ heightMm: 2000, name: "Кухня", type: "kitchen" })],
			},
		});
	});

	it("publishes one durable revision for valid Room metadata", async () => {
		const calls: PublicationCandidate[] = [];
		const repository: ProjectRevisionPublicationPort = {
			publishNextRevision: async (candidate) => {
				calls.push(candidate as PublicationCandidate);
				return { kind: "durable" };
			},
		};
		const ids: IdPort = { next: () => "revision-2" };
		const statuses: string[] = [];
		const useCase = new UpdateRoomPropertiesUseCase({
			checksum,
			clock,
			ids,
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{ heightMm: 2700, name: "Кухня", roomId: "room-1", type: "kitchen" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(statuses).toEqual(["saving", "saved"]);
		expect(calls).toEqual([
			expect.objectContaining({
					project: expect.objectContaining({
						level: expect.objectContaining({
							rooms: [
								expect.objectContaining({
									heightMm: 2700,
									name: "Кухня",
									type: "kitchen",
								}),
							],
						}),
					}),
				}),
		]);
	});

	it("rejects invalid Room properties before allocating or publishing", async () => {
		let allocations = 0;
		let publications = 0;
		const repository: ProjectRevisionPublicationPort = {
			publishNextRevision: async () => {
				publications += 1;
				return { kind: "durable" };
			},
		};
		const ids: IdPort = {
			next: () => {
				allocations += 1;
				return "unexpected";
			},
		};
		const useCase = new UpdateRoomPropertiesUseCase({
			checksum,
			clock,
			ids,
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{ heightMm: 2700, name: "", roomId: "room-1", type: "kitchen" },
				() => undefined,
			),
		).resolves.toEqual({ kind: "rejected", reasonCode: "ROOM_NAME_REQUIRED" });
		expect(allocations).toBe(0);
		expect(publications).toBe(0);
	});
});

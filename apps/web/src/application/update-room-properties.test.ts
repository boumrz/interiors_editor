import { describe, expect, it } from "@rstest/core";

import { configureRectangularRoom } from "../domain/rectangular-room";
import { createInitialProject } from "../domain/initial-project";
import { addDoorOpeningToProject } from "../domain/door-opening-project";
import { addGeneralWallToProject } from "../domain/general-wall-project";
import { createParametricFloorItem } from "../domain/parametric-item";
import type { Project } from "../domain/project";
import { canonicalProjectSerializer } from "./create-project";
import { UpdateRoomPropertiesUseCase, type UpdateRoomPropertiesStatus } from "./update-room-properties";
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

function withHiddenLayoutPlanter(base: PublicationCandidate, roomId = "room-1"): PublicationCandidate {
	const source: Project = { ...base.project, roomLayouts: [
		{ roomId, layoutId: "layout-a", slot: "A", name: "А" },
		{ roomId, layoutId: "layout-b", slot: "B", name: "Б" },
	] };
	const placed = createParametricFloorItem(source, {
		roomId, roomLayoutId: "layout-b", xMm: 3000, zMm: 1500, color: "#536d62", label: "Тумбочка",
		widthMm: 500, depthMm: 400, heightMm: 1800, catalogPreset: { presetId: "bedside-table", version: 1 },
	}, { next: () => "cabinet-b" }, source.updatedAt);
	if (placed.kind !== "accepted") throw new Error(`Expected valid support: ${placed.reasonCode}`);
	const project: Project = { ...placed.project, supportedItems: [{
		assetInstanceId: "planter-b", anchorClass: "support", label: "Кашпо", color: "#536d62",
		widthMm: 350, depthMm: 350, heightMm: 450, catalogPreset: { presetId: "planter", version: 1 },
		supportAssetInstanceId: "cabinet-b", supportSurfaceKey: "top", offsetXMm: 0, offsetZMm: 0, relativeYawMilliDeg: 0,
	}] };
	return { project, revision: { ...base.revision, serializedProject: canonicalProjectSerializer.serialize(project) } };
}

const clock: ClockPort = { now: () => "2026-08-15T18:02:00.000Z" };
const checksum: ChecksumPort = { sha256: async () => "sum:next" };

describe("UpdateRoomPropertiesUseCase", () => {
	it("checks a hidden layout's raised planter before saving the room ceiling and permits exact contact", async () => {
		const candidate = withHiddenLayoutPlanter(baseCandidate());
		const published: PublicationCandidate[] = [];
		const statuses: UpdateRoomPropertiesStatus["kind"][] = [];
		const useCase = new UpdateRoomPropertiesUseCase({
			checksum, clock, ids: { next: () => "revision-2" }, serializer: canonicalProjectSerializer,
			repository: { publishNextRevision: async (next) => { published.push(next as PublicationCandidate); return { kind: "durable" }; } },
		});
		const input = { heightMm: 2249, roomId: "room-1", type: "living-room" };
		await expect(useCase.execute(candidate, input, ({ kind }) => statuses.push(kind))).resolves.toEqual({
			kind: "rejected", reasonCode: "ROOM_HEIGHT_SUPPORTED_ITEM_CONFLICT", assetInstanceId: "planter-b",
		});
		expect(published).toEqual([]);
		expect(statuses).toEqual([]);
		expect(candidate.project.level.rooms[0]?.heightMm).toBe(2600);
		await expect(useCase.execute(candidate, { ...input, heightMm: 2250 }, () => undefined))
			.resolves.toMatchObject({ kind: "durable", revisionId: "revision-2" });
		expect(published[0]?.project.level.rooms[0]?.heightMm).toBe(2250);
		expect(published[0]?.project.supportedItems).toEqual(candidate.project.supportedItems);
	});

	it("keeps a ceiling conflict out of storage even through the door conflict confirmation", async () => {
		const candidate = withHiddenLayoutPlanter(candidateWithTallDoor());
		const useCase = new UpdateRoomPropertiesUseCase({
			checksum, clock, ids: { next: () => { throw new Error("No revision should be allocated"); } },
			serializer: canonicalProjectSerializer,
			repository: { publishNextRevision: async () => { throw new Error("No revision should be published"); } },
		});
		const result = await useCase.resolveOpeningConflict(candidate, {
			heightMm: 2000, roomId: "room-1", type: "living-room",
			openingResolutions: [{ kind: "delete", openingId: "door-1" }],
		}, () => { throw new Error("No publication status should be emitted"); });
		expect(result).toEqual({ kind: "rejected", reasonCode: "ROOM_HEIGHT_SUPPORTED_ITEM_CONFLICT", assetInstanceId: "planter-b" });
		expect(candidate.project.level.openings[0]?.openingId).toBe("door-1");
	});

	it("allows a lower ceiling in the room adjacent to the tall planter", async () => {
		const base = baseCandidate();
		const identities = ["bottom-contact", "top-contact", "bottom-tail", "top-tail", "divider", "room-east"][Symbol.iterator]();
		const split = addGeneralWallToProject(base.project, {
			start: { xMm: 2050, zMm: 0 }, end: { xMm: 2050, zMm: 3100 }, thicknessMm: 100,
		}, { next: () => identities.next().value ?? "" }, base.project.updatedAt);
		if (split.kind !== "accepted") throw new Error(`Expected valid partition: ${split.reasonCode}`);
		const candidate = withHiddenLayoutPlanter({ ...base, project: split.project }, "room-east");
		const published: PublicationCandidate[] = [];
		const useCase = new UpdateRoomPropertiesUseCase({
			checksum, clock, ids: { next: () => "revision-2" }, serializer: canonicalProjectSerializer,
			repository: { publishNextRevision: async (next) => { published.push(next as PublicationCandidate); return { kind: "durable" }; } },
		});
		await expect(useCase.execute(candidate, { heightMm: 2000, roomId: "room-1", type: "living-room" }, () => undefined))
			.resolves.toMatchObject({ kind: "durable" });
		expect(published[0]?.project.level.rooms.map(({ roomId, heightMm }) => [roomId, heightMm])).toEqual([
			["room-1", 2000], ["room-east", 2600],
		]);
	});

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

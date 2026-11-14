import { describe, expect, it } from "@rstest/core";
import { addDoorOpeningToProject } from "../domain/door-opening-project";
import {
	addGeneralWallToProject,
	splitGeneralWall,
} from "../domain/general-wall-project";
import { createInitialProject } from "../domain/initial-project";
import { createParametricWallItem } from "../domain/parametric-wall-item";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { canonicalProjectSerializer } from "./create-project";
import {
	AddGeneralWallToProjectUseCase,
	ChangeGeneralWallThicknessUseCase,
	DeleteGeneralVertexUseCase,
	DeleteGeneralWallFromProjectUseCase,
	MoveGeneralVertexUseCase,
	MoveGeneralWallUseCase,
	ReconcileMissingRoomsFromPlanGraphUseCase,
	ReverseGeneralWallUseCase,
	SplitGeneralWallUseCase,
} from "./general-wall-project-mutations";
import type { PublicationCandidate } from "./ports";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function baseCandidate(): PublicationCandidate {
	const room = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-12T10:00:00.000Z",
			levelId: "level-1",
			name: "План",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids(
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
		),
		"2026-08-12T10:01:00.000Z",
	);
	if (room.kind !== "accepted") {
		throw new Error("Expected room fixture");
	}
	return {
		project: room.project,
		revision: {
			checksum: "base",
			createdAt: room.project.updatedAt,
			projectId: "project-1",
			revisionId: "revision-1",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(room.project),
		},
	};
}

function candidateWithNamedSplitRooms(): PublicationCandidate {
	const base = baseCandidate();
	const added = addGeneralWallToProject(
		base.project,
		{
			end: { xMm: 2050, zMm: 3100 },
			start: { xMm: 2050, zMm: 0 },
			thicknessMm: 100,
		},
		ids(
			"divider-bottom",
			"divider-top",
			"bottom-tail",
			"top-tail",
			"divider",
			"room-right",
		),
		"2026-08-23T00:20:00.000Z",
	);
	if (added.kind !== "accepted" || added.project.schemaVersion !== 1) {
		throw new Error("Expected a two-room divider fixture");
	}
	return {
		...base,
		project: {
			...added.project,
			level: {
				...added.project.level,
				rooms: added.project.level.rooms.map((room) =>
					room.roomId === "room-1"
						? {
								...room,
								heightMm: 2750,
								name: "Кухня",
								type: "kitchen" as const,
							}
						: {
								...room,
								heightMm: 3100,
								name: "Гостиная",
								type: "living-room" as const,
							},
				),
			},
		},
	};
}

function candidateWithDoor(): PublicationCandidate {
	const base = baseCandidate();
	const added = addDoorOpeningToProject(
		base.project,
		{
			heightMm: 2100,
			offsetMm: 2050,
			sillMm: 0,
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		ids("door-1"),
		"2026-08-23T13:58:00.000Z",
	);
	if (added.kind !== "accepted") {
		throw new Error("Expected Door fixture");
	}
	return { ...base, project: added.project };
}

function candidateWithWallPanel(): PublicationCandidate {
	const base = baseCandidate();
	const placed = createParametricWallItem(
		base.project,
		{
			color: "#416b91",
			depthMm: 50,
			elevationMm: 1300,
			heightMm: 600,
			label: "Настенная панель",
			offsetMm: 2000,
			side: "right",
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		ids("wall-panel-1"),
		"2026-08-26T09:20:00.000Z",
	);
	if (placed.kind !== "accepted") {
		throw new Error("Expected wall-panel fixture");
	}
	return { ...base, project: placed.project };
}

function dependencies(
	idsPort = ids("free-start", "free-end", "free-wall", "revision-2"),
) {
	return {
		checksum: { sha256: async () => "sum:wall" },
		clock: { now: () => "2026-08-12T10:03:00.000Z" },
		ids: idsPort,
		repository: {
			loadCurrent: async () => ({ kind: "empty" as const }),
			publish: async () => ({ kind: "durable" as const }),
			publishNextRevision: async () => ({ kind: "durable" as const }),
			recover: async () => ({ kind: "recovered" as const }),
		},
		serializer: canonicalProjectSerializer,
	};
}

describe("general wall Project use cases", () => {
	it("publishes a selected wall-thickness change through the normal durable boundary", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const dependencySet = dependencies(ids("revision-2"));
		const useCase = new ChangeGeneralWallThicknessUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
			},
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{ thicknessMm: 200, wallSegmentId: "wall-1" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(statuses).toEqual(["saving", "saved"]);
		const candidate = published[0];
		if (candidate?.project.schemaVersion !== 1) {
			throw new Error("Expected a canonical V1 wall publication");
		}
		expect(candidate.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ thicknessMm: 200, wallSegmentId: "wall-1" }),
			]),
		);
		expect(candidate.project.level.rooms).toEqual([
			expect.objectContaining({ heightMm: 2600, roomId: "room-1" }),
		]);
	});

	it("does not publish a Durable Revision for an unchanged wall thickness", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const dependencySet = dependencies(ids("must-not-allocate-revision"));
		const useCase = new ChangeGeneralWallThicknessUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
			},
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{ thicknessMm: 100, wallSegmentId: "wall-1" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({ kind: "unchanged" });
		expect(published).toEqual([]);
		expect(statuses).toEqual([]);
	});

	it("finds the selected wall before treating a non-first segment as unchanged", async () => {
		const dependencySet = dependencies(ids("must-not-allocate-revision"));
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new ChangeGeneralWallThicknessUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
			},
		});
		const base = baseCandidate();
		const source = {
			...base,
			project: {
				...base.project,
				level: {
					...base.project.level,
					wallSegments: base.project.level.wallSegments.map((wall, index) =>
						index === 0 ? { ...wall, thicknessMm: 200 } : wall,
					),
				},
			},
		};

		await expect(
			useCase.execute(
				source,
				{ thicknessMm: 100, wallSegmentId: "wall-4" },
				() => undefined,
			),
		).resolves.toEqual({ kind: "unchanged" });
		expect(published).toEqual([]);
	});

	it("delegates a missing selected wall to the canonical domain rejection", async () => {
		const useCase = new ChangeGeneralWallThicknessUseCase(dependencies());

		await expect(
			useCase.execute(
				baseCandidate(),
				{ thicknessMm: 100, wallSegmentId: "missing-wall" },
				() => undefined,
			),
		).resolves.toEqual({ kind: "rejected", reasonCode: "WALL_NOT_FOUND" });
	});

	it("publishes a Wall direction reversal through the normal durable boundary", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const dependencySet = dependencies(ids("revision-2"));
		const useCase = new ReverseGeneralWallUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
			},
		});

		await expect(
			useCase.execute(baseCandidate(), { wallSegmentId: "wall-1" }, (status) =>
				statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(statuses).toEqual(["saving", "saved"]);
		expect(published[0]?.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "v-1",
					startVertexId: "v-2",
					wallSegmentId: "wall-1",
				}),
			]),
		);
	});

	it("rejects a stale base instead of overwriting it when reversing a Wall", async () => {
		const expectedBaseRevisionIds: string[] = [];
		let unconditionalPublishes = 0;
		const statuses: string[] = [];
		const dependencySet = dependencies(ids("revision-2"));
		const useCase = new ReverseGeneralWallUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publish: async () => {
					unconditionalPublishes += 1;
					return { kind: "durable" as const };
				},
				publishNextRevision: async (
					_candidate: import("./ports").DurablePublicationCandidate,
					expectedBaseRevisionId: string,
				) => {
					expectedBaseRevisionIds.push(expectedBaseRevisionId);
					return { kind: "stale-base" as const };
				},
			},
		});

		await expect(
			useCase.execute(baseCandidate(), { wallSegmentId: "wall-1" }, (status) =>
				statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(expectedBaseRevisionIds).toEqual(["revision-1"]);
		expect(unconditionalPublishes).toBe(0);
		expect(statuses).toEqual(["saving", "stale-base"]);
	});

	it("does not publish a reconciliation when a durable plan already has its Room metadata", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new ReconcileMissingRoomsFromPlanGraphUseCase({
			...dependencies(ids("must-not-allocate")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(baseCandidate(), () => undefined),
		).resolves.toEqual({ kind: "unchanged" });
		expect(published).toEqual([]);
	});

	it("publishes room metadata for a pre-fix closed graph that has none", async () => {
		let project = createInitialProject({
			createdAt: "2026-08-13T08:40:00.000Z",
			levelId: "level-1",
			name: "Контур",
			projectId: "project-1",
		});
		const drawIds = ids(
			"v-1",
			"v-2",
			"wall-1",
			"v-3",
			"wall-2",
			"v-4",
			"wall-3",
			"wall-4",
			"room-original",
		);
		for (const wall of [
			{ end: { xMm: 4000, zMm: 0 }, start: { xMm: 0, zMm: 0 } },
			{ end: { xMm: 4000, zMm: 3000 }, start: { xMm: 4000, zMm: 0 } },
			{ end: { xMm: 0, zMm: 3000 }, start: { xMm: 4000, zMm: 3000 } },
			{ end: { xMm: 0, zMm: 0 }, start: { xMm: 0, zMm: 3000 } },
		]) {
			const added = addGeneralWallToProject(
				project,
				{ ...wall, thicknessMm: 100 },
				drawIds,
				"2026-08-13T08:41:00.000Z",
			);
			if (added.kind !== "accepted") {
				throw new Error("Expected a closed graph fixture");
			}
			project = added.project;
		}
		const stale: PublicationCandidate = {
			project: { ...project, level: { ...project.level, rooms: [] } },
			revision: {
				checksum: "base",
				createdAt: project.updatedAt,
				projectId: "project-1",
				revisionId: "revision-1",
				schemaVersion: 1,
				serializedProject: "stale",
			},
		};
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new ReconcileMissingRoomsFromPlanGraphUseCase({
			...dependencies(ids("room-repaired", "revision-2")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(useCase.execute(stale, () => undefined)).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		const repaired = published[0];
		if (repaired?.project.schemaVersion !== 1) {
			throw new Error("Expected a repaired v1 publication");
		}
		expect(repaired.project.level.rooms).toEqual([
			expect.objectContaining({ roomId: "room-repaired" }),
		]);
	});

	it("publishes an explicit exterior segment through the normal v1 durable boundary", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const dependencySet = dependencies();
		const useCase = new AddGeneralWallToProjectUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
			},
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{
					end: { xMm: 6500, zMm: 5000 },
					start: { xMm: 5000, zMm: 5000 },
					thicknessMm: 100,
				},
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(statuses).toEqual(["saving", "saved"]);
		expect(published[0]?.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ wallSegmentId: "free-wall" }),
			]),
		);
	});

	it("publishes one refreshed AddWall host removal and T contact as one revision", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const dependencySet = dependencies(
			ids(
				"branch-start",
				"t-contact",
				"host-tail",
				"branch-wall",
				"revision-2",
			),
		);
		const useCase = new AddGeneralWallToProjectUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
			},
		});

		await expect(
			useCase.resolveHostConflict(
				candidateWithWallPanel(),
				{
					end: { xMm: 2000, zMm: 0 },
					itemIds: ["wall-panel-1"],
					openingIds: [],
					start: { xMm: 2000, zMm: 1000 },
					thicknessMm: 100,
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(published).toHaveLength(1);
		expect(published[0]?.project.assetInstances).toEqual([]);
	});

	it("publishes a wall split immediately and copies its predecessor height to every successor", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const candidate = baseCandidate();
		const namedCandidate: PublicationCandidate = {
			...candidate,
			project: {
				...candidate.project,
				level: {
					...candidate.project.level,
					rooms: candidate.project.level.rooms.map((room) => ({
						...room,
						heightMm: 2750,
						name: "Спальня",
						type: "bedroom" as const,
					})),
				},
			},
		};
		const dependencySet = dependencies(
			ids(
				"divider-bottom",
				"divider-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
				"revision-2",
			),
		);
		const useCase = new AddGeneralWallToProjectUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publishNextRevision: async (publishedCandidate) => {
					published.push(publishedCandidate);
					return { kind: "durable" as const };
				},
			},
		});

		await expect(
			useCase.execute(
				namedCandidate,
				{
					end: { xMm: 2050, zMm: 3100 },
					start: { xMm: 2050, zMm: 0 },
					thicknessMm: 100,
				},
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(statuses).toEqual(["saving", "saved"]);
		const splitProject = published[0]?.project;
		if (splitProject?.schemaVersion !== 1) {
			throw new Error("Expected a canonical V1 wall-split publication");
		}
		expect(splitProject.level.rooms).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ heightMm: 2750, roomId: "room-1" }),
				expect.objectContaining({ heightMm: 2750, roomId: "room-right" }),
			]),
		);
	});

	it("returns a domain rejection without creating a revision or publishing", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const dependencySet = dependencies(ids("must-not-allocate"));
		const useCase = new AddGeneralWallToProjectUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publish: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
			},
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{
					end: { xMm: 5000, zMm: 5000 },
					start: { xMm: 5000, zMm: 5000 },
					thicknessMm: 100,
				},
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({ kind: "rejected", reasonCode: "ZERO_LENGTH" });
		expect(statuses).toEqual([]);
		expect(published).toEqual([]);
	});

	it("keeps the candidate retryable when durable publication fails", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const dependencySet = dependencies();
		const useCase = new AddGeneralWallToProjectUseCase({
			...dependencySet,
			repository: {
				...dependencySet.repository,
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return {
						kind: "persist-failed" as const,
						reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
					};
				},
			},
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{
					end: { xMm: 6500, zMm: 5000 },
					start: { xMm: 5000, zMm: 5000 },
					thicknessMm: 100,
				},
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(statuses).toEqual(["saving", "persist-failed"]);
		expect(published).toHaveLength(1);
	});

	it("publishes confirmed deletion of a selected exterior wall with its Room consequence", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new DeleteGeneralWallFromProjectUseCase({
			...dependencies(ids("revision-2")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{
					itemIds: [],
					openingIds: [],
					roomIds: ["room-1"],
					wallSegmentId: "wall-1",
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(
			published[0]?.project.level.wallSegments.map(
				(wall) => wall.wallSegmentId,
			),
		).not.toContain("wall-1");
	});

	it("rejects selected-Wall deletion when its previewed Durable Revision is stale", async () => {
		const base = baseCandidate();
		const added = addGeneralWallToProject(
			base.project,
			{
				end: { xMm: 6500, zMm: 5000 },
				start: { xMm: 5000, zMm: 5000 },
				thicknessMm: 100,
			},
			ids("free-start", "free-end", "free-wall"),
			"2026-08-27T11:30:00.000Z",
		);
		if (added.kind !== "accepted") {
			throw new Error("Expected a detached wall fixture");
		}
		const expectedBases: string[] = [];
		const statuses: string[] = [];
		const dependencySet = dependencies(ids("revision-2"));
		const repository = {
			...dependencySet.repository,
			publish: async () => {
				throw new Error("Deletion must not use unconditional publish");
			},
			publishNextRevision: async (
				_candidate: import("./ports").DurablePublicationCandidate,
				expectedBaseRevisionId: string,
			) => {
				expectedBases.push(expectedBaseRevisionId);
				return { kind: "stale-base" as const };
			},
		};
		const useCase = new DeleteGeneralWallFromProjectUseCase({
			...dependencySet,
			repository,
		});

		await expect(
			useCase.execute(
				{ ...base, project: added.project },
				{ wallSegmentId: "free-wall" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(expectedBases).toEqual(["revision-1"]);
		expect(statuses).toEqual(["saving", "stale-base"]);
	});

	it("requires an explicit retained Room before publishing deletion that merges named Rooms", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new DeleteGeneralWallFromProjectUseCase({
			...dependencies(ids("revision-2")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});
		const source = candidateWithNamedSplitRooms();

		await expect(
			useCase.execute(source, { wallSegmentId: "divider" }, () => undefined),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "WALL_DELETION_CONFLICT",
		});
		expect(published).toEqual([]);

		await expect(
			useCase.execute(
				source,
				{
					itemIds: [],
					openingIds: [],
					roomIds: ["room-1", "room-right"],
					roomMetadataResolutions: [
						{
							retainedRoomId: "room-right",
							targetFaceKey: "0:4100:0:3100:100:100:100:100",
						},
					],
					wallSegmentId: "divider",
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		const merged = published[0]?.project;
		if (merged?.schemaVersion !== 1) {
			throw new Error("Expected a canonical V1 merged-room publication");
		}
		expect(merged.level.rooms).toEqual([
			expect.objectContaining({
				heightMm: 3100,
				name: "Гостиная",
				roomId: "room-right",
				type: "living-room",
			}),
		]);
	});

	it("publishes one exact selected-wall movement through the durable boundary", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new MoveGeneralWallUseCase({
			...dependencies(ids("revision-2")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(
				candidateWithNamedSplitRooms(),
				{ positionMm: 1700, wallSegmentId: "divider" },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		const moved = published[0]?.project;
		if (moved?.schemaVersion !== 1) {
			throw new Error("Expected a canonical V1 wall-move publication");
		}
		expect(moved.level.rooms).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					faceFingerprint: "grid:0:1700:0:3100:100",
					roomId: "room-1",
				}),
				expect.objectContaining({
					faceFingerprint: "grid:1700:4100:0:3100:100",
					roomId: "room-right",
				}),
			]),
		);
	});

	it("publishes one exact selected-wall split through the durable boundary", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new SplitGeneralWallUseCase({
			...dependencies(ids("split-vertex", "split-tail", "revision-2")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{ positionMm: 2000, wallSegmentId: "wall-1" },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		const split = published[0]?.project;
		if (split?.schemaVersion !== 1) {
			throw new Error("Expected a canonical V1 wall-split publication");
		}
		expect(split.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					endVertexId: "split-vertex",
					wallSegmentId: "wall-1",
				}),
				expect.objectContaining({
					startVertexId: "split-vertex",
					wallSegmentId: "split-tail",
				}),
			]),
		);
	});

	it("publishes the explicit removal of a Door cut by a selected wall split as one revision", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new SplitGeneralWallUseCase({
			...dependencies(ids("split-vertex", "split-tail", "revision-2")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.resolveOpeningConflict(
				candidateWithDoor(),
				{ openingIds: ["door-1"], positionMm: 2050, wallSegmentId: "wall-1" },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(published[0]?.project.level.openings).toEqual([]);
		expect(published[0]?.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ wallSegmentId: "wall-1" }),
				expect.objectContaining({ wallSegmentId: "split-tail" }),
			]),
		);
	});

	it("publishes one refreshed wall-panel removal and split as one revision", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new SplitGeneralWallUseCase({
			...dependencies(ids("split-vertex", "split-tail", "revision-2")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});

		await expect(
			useCase.resolveHostConflict(
				candidateWithWallPanel(),
				{
					itemIds: ["wall-panel-1"],
					openingIds: [],
					positionMm: 2000,
					wallSegmentId: "wall-1",
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(published[0]?.project.assetInstances).toEqual([]);
		expect(published[0]?.project.level.wallSegments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ wallSegmentId: "wall-1" }),
				expect.objectContaining({ wallSegmentId: "split-tail" }),
			]),
		);
	});

	it("publishes an exact safe inline-Vertex move through the durable boundary", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new MoveGeneralVertexUseCase({
			...dependencies(ids("revision-2")),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => ({ kind: "durable" as const }),
				publishNextRevision: async (candidate) => {
					published.push(candidate);
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
		});
		const base = baseCandidate();
		const split = splitGeneralWall(
			base.project,
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("inline-vertex", "wall-1-tail"),
			"2026-08-23T04:20:00.000Z",
		);
		if (split.kind !== "accepted")
			throw new Error("Expected inline-Vertex fixture");

		await expect(
			useCase.execute(
				{ ...base, project: split.project },
				{ vertexId: "inline-vertex", xMm: 1800, zMm: 0 },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(published[0]?.project.level.vertices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					vertexId: "inline-vertex",
					xMm: 1800,
					zMm: 0,
				}),
			]),
		);
	});

	it("rejects inline-Vertex deletion when its previewed Durable Revision is stale", async () => {
		const base = baseCandidate();
		const split = splitGeneralWall(
			base.project,
			{ positionMm: 2000, wallSegmentId: "wall-1" },
			ids("inline-vertex", "wall-1-tail"),
			"2026-08-27T11:40:00.000Z",
		);
		if (split.kind !== "accepted") {
			throw new Error("Expected an inline-Vertex fixture");
		}
		const expectedBases: string[] = [];
		const statuses: string[] = [];
		const dependencySet = dependencies(ids("revision-2"));
		const repository = {
			...dependencySet.repository,
			publish: async () => {
				throw new Error("Deletion must not use unconditional publish");
			},
			publishNextRevision: async (
				_candidate: import("./ports").DurablePublicationCandidate,
				expectedBaseRevisionId: string,
			) => {
				expectedBases.push(expectedBaseRevisionId);
				return { kind: "stale-base" as const };
			},
		};
		const useCase = new DeleteGeneralVertexUseCase({
			...dependencySet,
			repository,
		});

		await expect(
			useCase.execute(
				{ ...base, project: split.project },
				{ vertexId: "inline-vertex" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(expectedBases).toEqual(["revision-1"]);
		expect(statuses).toEqual(["saving", "stale-base"]);
	});
});

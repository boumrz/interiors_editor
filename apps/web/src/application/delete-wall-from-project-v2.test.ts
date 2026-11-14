import { describe, expect, it } from "@rstest/core";

import { DeleteWallFromProjectV2UseCase } from "./delete-wall-from-project-v2";
import { canonicalProjectSerializer } from "./create-project";
import type {
	ChecksumPort,
	ClockPort,
	DurablePublicationCandidate,
	IdPort,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	V2PublicationCandidate,
} from "./ports";
import { addWallToProjectV2 } from "../domain/add-wall-to-project-v2";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { createInitialProject } from "../domain/initial-project";
import { migrateProjectV1ToV2 } from "../domain/migrate-project-v1-to-v2";

const clock: ClockPort = { now: () => "2026-08-06T14:10:00.000Z" };
const checksum: ChecksumPort = {
	sha256: async (value) => `checksum:${value.length}`,
};

function ids(...values: string[]): IdPort {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function partitionedCandidate(): V2PublicationCandidate {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-06T14:00:00.000Z",
			levelId: "level-1",
			name: "Удаление свободной стены",
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
		"2026-08-06T14:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected v1 fixture");
	}
	const migrated = migrateProjectV1ToV2(configured.project);
	if (migrated.kind !== "accepted") {
		throw new Error("Expected v2 fixture");
	}
	const partitioned = addWallToProjectV2(
		migrated.project,
		{
			end: { xMm: 2050, zMm: 3100 },
			start: { xMm: 2050, zMm: 0 },
			thicknessMm: 100,
		},
		ids(
			"v-bottom",
			"v-top",
			"bottom-tail",
			"top-tail",
			"divider",
			"room-right",
		),
		"2026-08-06T14:02:00.000Z",
	);
	if (partitioned.kind !== "accepted") {
		throw new Error("Expected v2 partition fixture");
	}
	return {
		project: partitioned.project,
		revision: {
			checksum: "checksum:v2",
			createdAt: partitioned.project.updatedAt,
			projectId: partitioned.project.projectId,
			revisionId: "revision-v2",
			schemaVersion: 2,
			serializedProject: canonicalProjectSerializer.serialize(
				partitioned.project,
			),
		},
	};
}

describe("DeleteWallFromProjectV2UseCase", () => {
	it("publishes a selected free-wall deletion as one durable v2 revision", async () => {
		const published: DurablePublicationCandidate[] = [];
		const statuses: string[] = [];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				throw new Error(
					"A V2 mutation must not publish without a base revision",
				);
			},
			publishNextRevision: async (candidate, expectedBaseRevisionId) => {
				expect(expectedBaseRevisionId).toBe("revision-v2");
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const useCase = new DeleteWallFromProjectV2UseCase({
			checksum,
			clock,
			ids: ids("revision-3"),
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				partitionedCandidate(),
				{ wallSegmentId: "divider" },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});

		expect(statuses).toEqual(["saving", "saved"]);
		expect(published).toEqual([
			expect.objectContaining({
				project: expect.objectContaining({
					schemaVersion: 2,
					updatedAt: "2026-08-06T14:10:00.000Z",
					level: expect.objectContaining({
						roomMetadata: [
							expect.objectContaining({ roomId: "room-1", heightMm: 2600 }),
						],
						wallSegments: expect.arrayContaining([
							expect.objectContaining({ wallSegmentId: "wall-1" }),
						]),
					}),
				}),
				revision: expect.objectContaining({
					checksum: expect.stringMatching(/^checksum:/),
					createdAt: "2026-08-06T14:10:00.000Z",
					revisionId: "revision-3",
					schemaVersion: 2,
				}),
			}),
		]);
	});

	it("does not allocate a Durable Revision or publish when the pure merge is rejected", async () => {
		const base = partitionedCandidate();
		const first = base.project.level.roomMetadata[0];
		const second = base.project.level.roomMetadata[1];
		if (!first || !second) {
			throw new Error("Expected two room metadata entries");
		}
		const conflicting: V2PublicationCandidate = {
			...base,
			project: {
				...base.project,
				level: {
					...base.project.level,
					roomMetadata: [first, { ...second, heightMm: 3000 }],
				},
			},
		};
		let publications = 0;
		const useCase = new DeleteWallFromProjectV2UseCase({
			checksum: {
				sha256: async () => {
					throw new Error("Rejected delete must not hash");
				},
			},
			clock,
			ids: {
				next: () => {
					throw new Error("Rejected delete must not allocate a revision");
				},
			},
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => {
					publications += 1;
					return { kind: "durable" as const };
				},
				publishNextRevision: async () => {
					publications += 1;
					return { kind: "durable" as const };
				},
				recover: async () => ({ kind: "recovered" }),
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				conflicting,
				{ wallSegmentId: "divider" },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "ROOM_HEIGHT_CONFLICT",
		});
		expect(publications).toBe(0);
	});

	it("keeps the calculated v2 deletion candidate for retry if durable publication fails", async () => {
		const statuses: Array<{
			readonly kind: string;
			readonly candidate?: V2PublicationCandidate;
		}> = [];
		const useCase = new DeleteWallFromProjectV2UseCase({
			checksum,
			clock,
			ids: ids("revision-3"),
			repository: {
				loadCurrent: async () => ({ kind: "empty" }),
				publish: async () => {
					throw new Error(
						"A V2 mutation must not publish without a base revision",
					);
				},
				publishNextRevision: async () => ({
					kind: "persist-failed" as const,
					reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
				}),
				recover: async () => ({ kind: "recovered" }),
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				partitionedCandidate(),
				{ wallSegmentId: "divider" },
				(status) => statuses.push(status),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});

		expect(statuses.map((status) => status.kind)).toEqual([
			"saving",
			"persist-failed",
		]);
		expect(statuses[1]?.candidate).toEqual(
			expect.objectContaining({
				project: expect.objectContaining({
					schemaVersion: 2,
					level: expect.objectContaining({ wallSegments: expect.any(Array) }),
				}),
				revision: expect.objectContaining({
					revisionId: "revision-3",
					schemaVersion: 2,
				}),
			}),
		);
	});
});

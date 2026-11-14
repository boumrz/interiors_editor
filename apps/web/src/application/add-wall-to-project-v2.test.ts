import { describe, expect, it } from "@rstest/core";

import { AddWallToProjectV2UseCase } from "./add-wall-to-project-v2";
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
import { configureRectangularRoom } from "../domain/rectangular-room";
import { createInitialProject } from "../domain/initial-project";
import { migrateProjectV1ToV2 } from "../domain/migrate-project-v1-to-v2";

const clock: ClockPort = { now: () => "2026-08-06T13:30:00.000Z" };
const checksum: ChecksumPort = {
	sha256: async (value) => `checksum:${value.length}`,
};

function ids(...values: string[]): IdPort {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function v2Candidate(): V2PublicationCandidate {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-06T13:00:00.000Z",
			levelId: "level-1",
			name: "Свободные стены",
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
		"2026-08-06T13:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected v1 fixture");
	}
	const migrated = migrateProjectV1ToV2(configured.project);
	if (migrated.kind !== "accepted") {
		throw new Error("Expected v2 fixture");
	}
	return {
		project: migrated.project,
		revision: {
			checksum: "checksum:v2",
			createdAt: migrated.project.updatedAt,
			projectId: migrated.project.projectId,
			revisionId: "revision-v2",
			schemaVersion: 2,
			serializedProject: canonicalProjectSerializer.serialize(migrated.project),
		},
	};
}

describe("AddWallToProjectV2UseCase", () => {
	it("publishes one v2 revision after a free wall becomes a normalized graph mutation", async () => {
		const published: DurablePublicationCandidate[] = [];
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
		const useCase = new AddWallToProjectV2UseCase({
			checksum,
			clock,
			ids: ids(
				"v-bottom",
				"v-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
				"revision-3",
			),
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				v2Candidate(),
				{
					end: { xMm: 2050, zMm: 3100 },
					start: { xMm: 2050, zMm: 0 },
					thicknessMm: 100,
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});
		expect(published).toEqual([
			expect.objectContaining({
				project: expect.objectContaining({
					level: expect.objectContaining({
						roomMetadata: [
							expect.objectContaining({ roomId: "room-1" }),
							expect.objectContaining({ roomId: "room-right" }),
						],
					}),
					schemaVersion: 2,
				}),
			}),
		]);
	});

	it("rejects a stale v2 base instead of overwriting a newer durable revision", async () => {
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
				_candidate: DurablePublicationCandidate,
				expectedBaseRevisionId: string,
			) => {
				expectedBaseRevisionIds.push(expectedBaseRevisionId);
				return { kind: "stale-base" as const };
			},
			recover: async () => ({ kind: "recovered" as const }),
		};
		const useCase = new AddWallToProjectV2UseCase({
			checksum,
			clock,
			ids: ids(
				"v-bottom",
				"v-top",
				"bottom-tail",
				"top-tail",
				"divider",
				"room-right",
				"revision-3",
			),
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				v2Candidate(),
				{
					end: { xMm: 2050, zMm: 3100 },
					start: { xMm: 2050, zMm: 0 },
					thicknessMm: 100,
				},
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});

		expect(expectedBaseRevisionIds).toEqual(["revision-v2"]);
		expect(unconditionalPublishes).toBe(0);
		expect(statuses).toEqual(["saving", "stale-base"]);
	});

	it("does not publish or allocate a revision when a free wall is invalid", async () => {
		let publicationCount = 0;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publicationCount += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => {
				publicationCount += 1;
				return { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const useCase = new AddWallToProjectV2UseCase({
			checksum,
			clock,
			ids: {
				next: () => {
					throw new Error("Invalid v2 wall must not allocate an identity");
				},
			},
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				v2Candidate(),
				{
					end: { xMm: 1000, zMm: 1000 },
					start: { xMm: 0, zMm: 0 },
					thicknessMm: 100,
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "UNSUPPORTED_DIRECTION",
		});
		expect(publicationCount).toBe(0);
	});
});

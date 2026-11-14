import { describe, expect, it } from "@rstest/core";

import { ResizeParametricFloorItemV2UseCase } from "./resize-parametric-floor-item-v2";
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
import { createParametricFloorItemV2 } from "../domain/parametric-item-v2";
import { migrateProjectV1ToV2 } from "../domain/migrate-project-v1-to-v2";

const clock: ClockPort = { now: () => "2026-08-06T15:30:00.000Z" };
const checksum: ChecksumPort = {
	sha256: async (value) => `checksum:${value.length}`,
};

function ids(...values: string[]): IdPort {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithItem(): V2PublicationCandidate {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-06T15:00:00.000Z",
			levelId: "level-1",
			name: "Изменение размера v2",
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
		"2026-08-06T15:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected v1 room fixture");
	}
	const migrated = migrateProjectV1ToV2(configured.project);
	if (migrated.kind !== "accepted") {
		throw new Error("Expected v2 room fixture");
	}
	const withItem = createParametricFloorItemV2(
		migrated.project,
		{
			color: "#2f80ed",
			depthMm: 700,
			heightMm: 750,
			label: "Стол",
			roomId: "room-1",
			widthMm: 1200,
			xMm: 1500,
			zMm: 1500,
		},
		ids("item-1"),
		"2026-08-06T15:02:00.000Z",
	);
	if (withItem.kind !== "accepted") {
		throw new Error("Expected v2 item fixture");
	}
	return {
		project: withItem.project,
		revision: {
			checksum: "checksum:v2",
			createdAt: withItem.project.updatedAt,
			projectId: withItem.project.projectId,
			revisionId: "revision-v2",
			schemaVersion: 2,
			serializedProject: canonicalProjectSerializer.serialize(withItem.project),
		},
	};
}

describe("ResizeParametricFloorItemV2UseCase", () => {
	it("publishes a valid dimension change as one durable v2 revision", async () => {
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
		const useCase = new ResizeParametricFloorItemV2UseCase({
			checksum,
			clock,
			ids: ids("revision-3"),
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidateWithItem(),
				{
					assetInstanceId: "item-1",
					depthMm: 800,
					heightMm: 900,
					widthMm: 1300,
				},
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-3",
		});

		expect(statuses).toEqual(["saving", "saved"]);
		const candidate = published[0];
		if (!candidate) {
			throw new Error("Expected one durable candidate");
		}
		expect(candidate).toEqual(
			expect.objectContaining({
				project: expect.objectContaining({
					assetInstances: [
						expect.objectContaining({
							assetInstanceId: "item-1",
							depthMm: 800,
							heightMm: 900,
							widthMm: 1300,
						}),
					],
					schemaVersion: 2,
					updatedAt: "2026-08-06T15:30:00.000Z",
				}),
				revision: expect.objectContaining({
					revisionId: "revision-3",
					schemaVersion: 2,
				}),
			}),
		);
		expect(candidate.revision.serializedProject).toBe(
			canonicalProjectSerializer.serialize(candidate.project),
		);
		expect(candidate.revision.checksum).toBe(
			`checksum:${candidate.revision.serializedProject.length}`,
		);
	});

	it("does not hash, allocate a revision, or publish a rejected v2 resize", async () => {
		let publications = 0;
		const statuses: string[] = [];
		const useCase = new ResizeParametricFloorItemV2UseCase({
			checksum: {
				sha256: async () => {
					throw new Error("Rejected resize must not hash");
				},
			},
			clock,
			ids: {
				next: () => {
					throw new Error("Rejected resize must not allocate a revision");
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
				candidateWithItem(),
				{ assetInstanceId: "item-1", depthMm: 0, heightMm: 900, widthMm: 1300 },
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({ kind: "rejected", reasonCode: "INVALID_DIMENSION" });

		expect(publications).toBe(0);
		expect(statuses).toEqual([]);
	});

	it("retains the resized v2 candidate for retry after a persistence failure", async () => {
		const statuses: Array<{
			readonly kind: string;
			readonly candidate?: V2PublicationCandidate;
		}> = [];
		const useCase = new ResizeParametricFloorItemV2UseCase({
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
				candidateWithItem(),
				{
					assetInstanceId: "item-1",
					depthMm: 800,
					heightMm: 900,
					widthMm: 1300,
				},
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
					assetInstances: [
						expect.objectContaining({
							depthMm: 800,
							heightMm: 900,
							widthMm: 1300,
						}),
					],
					schemaVersion: 2,
				}),
				revision: expect.objectContaining({
					revisionId: "revision-3",
					schemaVersion: 2,
				}),
			}),
		);
	});
});

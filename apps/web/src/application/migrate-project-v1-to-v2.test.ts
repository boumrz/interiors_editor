import { describe, expect, it } from "@rstest/core";

import { canonicalProjectSerializer } from "./create-project";
import { MigrateProjectV1ToV2UseCase } from "./migrate-project-v1-to-v2";
import type {
	ChecksumPort,
	ClockPort,
	DurablePublicationCandidate,
	IdPort,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	PublicationCandidate,
} from "./ports";
import { createInitialProject } from "../domain/initial-project";
import { configureRectangularRoom } from "../domain/rectangular-room";

const clock: ClockPort = { now: () => "2026-08-06T13:20:00.000Z" };
const checksum: ChecksumPort = {
	sha256: async (value) => `checksum:${value.length}`,
};

function ids(...values: string[]): IdPort {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function v1Candidate(): PublicationCandidate {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-06T13:00:00.000Z",
			levelId: "level-1",
			name: "Переход",
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
	return {
		project: configured.project,
		revision: {
			checksum: "checksum:v1",
			createdAt: configured.project.updatedAt,
			projectId: configured.project.projectId,
			revisionId: "revision-v1",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(
				configured.project,
			),
		},
	};
}

describe("MigrateProjectV1ToV2UseCase", () => {
	it("publishes a v2 durable revision only after lossless domain reconciliation succeeds", async () => {
		const published: DurablePublicationCandidate[] = [];
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				throw new Error(
					"A V2 mutation must not publish without a base revision",
				);
			},
			publishNextRevision: async (candidate, expectedBaseRevisionId) => {
				expect(expectedBaseRevisionId).toBe("revision-v1");
				published.push(candidate);
				return { kind: "durable" };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const useCase = new MigrateProjectV1ToV2UseCase({
			checksum,
			clock,
			ids: ids("revision-v2"),
			repository,
			serializer: canonicalProjectSerializer,
		});
		const statuses: string[] = [];

		await expect(
			useCase.execute(v1Candidate(), (status) => statuses.push(status.kind)),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-v2",
		});
		expect(statuses).toEqual(["saving", "saved"]);
		expect(published).toEqual([
			expect.objectContaining({
				project: expect.objectContaining({ schemaVersion: 2 }),
				revision: expect.objectContaining({
					schemaVersion: 2,
					revisionId: "revision-v2",
				}),
			}),
		]);
	});

	it("does not allocate a revision or publish a v2 candidate when v1 room descriptors cannot reconcile", async () => {
		let publishCount = 0;
		const repository: ProjectRepositoryPort & ProjectRevisionPublicationPort = {
			loadCurrent: async () => ({ kind: "empty" }),
			publish: async () => {
				publishCount += 1;
				return { kind: "durable" };
			},
			publishNextRevision: async () => {
				publishCount += 1;
				return { kind: "durable" as const };
			},
			recover: async () => ({ kind: "recovered" }),
		};
		const candidate = v1Candidate();
		const room = candidate.project.level.rooms[0];
		if (!room) {
			throw new Error("Expected v1 room fixture");
		}
		const malformed: PublicationCandidate = {
			...candidate,
			project: {
				...candidate.project,
				level: {
					...candidate.project.level,
					rooms: [{ ...room, faceFingerprint: "not-a-v1-face" }],
				},
			},
		};
		const useCase = new MigrateProjectV1ToV2UseCase({
			checksum,
			clock,
			ids: {
				next: () => {
					throw new Error("A rejected migration must not allocate a revision");
				},
			},
			repository,
			serializer: canonicalProjectSerializer,
		});

		await expect(useCase.execute(malformed, () => undefined)).resolves.toEqual({
			kind: "rejected",
			reasonCode: "LEGACY_ROOM_DESCRIPTOR_UNSUPPORTED",
		});
		expect(publishCount).toBe(0);
	});
});

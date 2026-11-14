import { describe, expect, it } from "@rstest/core";

import { createParametricWallItem } from "../domain/parametric-wall-item";
import { createInitialProject } from "../domain/initial-project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { CreateParametricWallItemUseCase } from "./create-parametric-wall-item";
import { canonicalProjectSerializer } from "./create-project";
import type {
	ChecksumPort,
	ClockPort,
	IdPort,
	ProjectRevisionPublicationPort,
	PublicationCandidate,
} from "./ports";

function ids(...values: string[]): IdPort {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function baseCandidate(): PublicationCandidate {
	const room = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-23T12:00:00.000Z",
			levelId: "level-1",
			name: "Гостиная",
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
		"2026-08-23T12:01:00.000Z",
	);
	if (room.kind !== "accepted") throw new Error("Expected room fixture");
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

describe("CreateParametricWallItemUseCase", () => {
	it("publishes a wall-local panel through the normal durable revision boundary", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const statuses: import("./create-parametric-wall-item").CreateParametricWallItemStatus[] =
			[];
		const repository: ProjectRevisionPublicationPort = {
			publishNextRevision: async (candidate, expectedBaseRevisionId) => {
				expect(expectedBaseRevisionId).toBe("revision-1");
				published.push(candidate);
				return { kind: "durable" };
			},
		};
		const useCase = new CreateParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:panel" } as ChecksumPort,
			clock: { now: () => "2026-08-23T12:02:00.000Z" } as ClockPort,
			ids: ids("panel-1", "revision-2"),
			repository,
			serializer: canonicalProjectSerializer,
		});

		const result = await useCase.execute(
			baseCandidate(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2000,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			(status) => statuses.push(status),
		);
		expect(result).toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(result).not.toHaveProperty("warnings");
		expect(published[0]?.project.assetInstances).toEqual([
			expect.objectContaining({
				anchorClass: "wall",
				assetInstanceId: "panel-1",
				wallSegmentId: "wall-1",
			}),
		]);
		expect(statuses).toEqual([
			{ kind: "saving" },
			{
				candidate: expect.objectContaining({
					project: expect.objectContaining({
						assetInstances: [
							expect.objectContaining({ assetInstanceId: "panel-1" }),
						],
					}),
				}),
				kind: "saved",
			},
		]);
	});

	it("publishes an overlapping panel durably and carries its named warning to the caller", async () => {
		const base = baseCandidate();
		const first = createParametricWallItem(
			base.project,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Первая панель",
				offsetMm: 2000,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
		ids("panel-1"),
		"2026-08-23T12:02:00.000Z",
	);
		if (first.kind !== "accepted") throw new Error("Expected panel fixture");
		const candidate: PublicationCandidate = {
			project: first.project,
			revision: {
				...base.revision,
				createdAt: first.project.updatedAt,
				serializedProject: canonicalProjectSerializer.serialize(first.project),
			},
		};
		const useCase = new CreateParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:overlap" },
			clock: { now: () => "2026-08-23T12:03:00.000Z" },
			ids: ids("panel-2", "revision-2"),
			repository: { publishNextRevision: async () => ({ kind: "durable" }) },
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				candidate,
				{
					color: "#8b4f27",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Вторая панель",
					offsetMm: 2000,
					side: "left",
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
			warnings: [{ assetInstanceId: "panel-1", kind: "wall-item" }],
		});
	});

	it("does not allocate a revision or publish an invalid wall-hosted item", async () => {
		let published = 0;
		const useCase = new CreateParametricWallItemUseCase({
			checksum: { sha256: async () => "must-not-hash" },
			clock: { now: () => "2026-08-23T12:02:00.000Z" },
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
				baseCandidate(),
				{
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Настенная панель",
					offsetMm: 2000,
					side: "left",
					wallSegmentId: "missing",
					widthMm: 900,
				},
				() => undefined,
			),
		).resolves.toEqual({ kind: "rejected", reasonCode: "WALL_HOST_NOT_FOUND" });
		expect(published).toBe(0);
	});

	it("refuses an unpinned wall-model reference before allocating or publishing", async () => {
		let published = 0;
		const statuses: import("./create-parametric-wall-item").CreateParametricWallItemStatus[] =
			[];
		const useCase = new CreateParametricWallItemUseCase({
			checksum: {
				sha256: async () => {
					throw new Error("An unpinned model must not be hashed");
				},
			} as ChecksumPort,
			clock: { now: () => "2026-08-23T12:02:00.000Z" } as ClockPort,
			ids: {
				next: () => {
					throw new Error("An unpinned model must not allocate an ID");
				},
			} as IdPort,
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
				baseCandidate(),
				{
					assetDefinitionId: "model-not-pinned",
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "GLB-панель",
					offsetMm: 2000,
					side: "left",
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				(status) => statuses.push(status),
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "ASSET_DEFINITION_NOT_PINNED",
		});
		expect(published).toBe(0);
		expect(statuses).toEqual([]);
	});

	it("rejects a panel whose preview base lost the current durable pointer", async () => {
		const expectedBaseRevisionIds: string[] = [];
		const statuses: string[] = [];
		const useCase = new CreateParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:panel" },
			clock: { now: () => "2026-08-23T12:02:00.000Z" },
			ids: ids("panel-1", "revision-2"),
			repository: {
				publishNextRevision: async (_candidate, expectedBaseRevisionId) => {
					expectedBaseRevisionIds.push(expectedBaseRevisionId);
					return { kind: "stale-base" as const };
				},
			},
			serializer: canonicalProjectSerializer,
		});

		await expect(
			useCase.execute(
				baseCandidate(),
				{
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Настенная панель",
					offsetMm: 2000,
					side: "left",
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				(status) => statuses.push(status.kind),
			),
		).resolves.toEqual({
			kind: "stale-base",
			reasonCode: "STALE_BASE_REVISION",
		});
		expect(expectedBaseRevisionIds).toEqual(["revision-1"]);
		expect(statuses).toEqual(["saving", "stale-base"]);
	});

	it("keeps a persistence failure non-durable and exposes its candidate status", async () => {
		const statuses: import("./create-parametric-wall-item").CreateParametricWallItemStatus[] =
			[];
		const useCase = new CreateParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:panel" },
			clock: { now: () => "2026-08-23T12:02:00.000Z" },
			ids: ids("panel-1", "revision-2"),
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
				{
					color: "#416b91",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "Настенная панель",
					offsetMm: 2000,
					side: "left",
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				(status) => statuses.push(status),
			),
		).resolves.toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(statuses).toEqual([
			{ kind: "saving" },
			{
				candidate: expect.objectContaining({
					project: expect.objectContaining({
						assetInstances: [
							expect.objectContaining({ assetInstanceId: "panel-1" }),
						],
					}),
				}),
				kind: "persist-failed",
				reasonCode: "PERSISTENCE_WRITE_FAILED",
			},
		]);
	});
});

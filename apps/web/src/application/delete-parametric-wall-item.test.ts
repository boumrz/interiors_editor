import { describe, expect, it } from "@rstest/core";

import { createInitialProject } from "../domain/initial-project";
import { createParametricWallItem } from "../domain/parametric-wall-item";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { canonicalProjectSerializer } from "./create-project";
import { DeleteParametricWallItemUseCase } from "./delete-parametric-wall-item";
import type { PublicationCandidate } from "./ports";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function candidateWithWallItem(): PublicationCandidate {
	const room = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-23T16:00:00.000Z",
			levelId: "level-1",
			name: "Квартира",
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
		"2026-08-23T16:01:00.000Z",
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
		"2026-08-23T16:02:00.000Z",
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

describe("DeleteParametricWallItemUseCase", () => {
	it("publishes removal of precisely the selected wall object", async () => {
		const published: import("./ports").DurablePublicationCandidate[] = [];
		const useCase = new DeleteParametricWallItemUseCase({
			checksum: { sha256: async () => "sum:deleted" },
			clock: { now: () => "2026-08-23T16:03:00.000Z" },
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
				{ assetInstanceId: "panel-1" },
				() => undefined,
			),
		).resolves.toEqual({
			kind: "durable",
			projectId: "project-1",
			revisionId: "revision-2",
		});
		expect(published[0]?.project.assetInstances).toEqual([]);
	});
});

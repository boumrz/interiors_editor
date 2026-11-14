import { expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import type { Project } from "../domain/project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { assessBrowserBackupRepresentability } from "./browser-backup-representability";

function room(): Project {
	let id = 0;
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-11-04T12:00:00.000Z",
			levelId: "level",
			name: "Plain data",
			projectId: "source",
		}),
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		{ next: () => `geometry-${++id}` },
		"2026-11-04T12:00:00.000Z",
	);
	if (configured.kind !== "accepted")
		throw new Error("Room prerequisite failed");
	return configured.project;
}
const checksum = {
	sha256Bytes: async () => {
		throw new Error("No resource digest is needed");
	},
};
const rejected = {
	kind: "rejected",
	reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
};
it("rejects custom data prototypes without silently replacing them during legacy serialization", async () => {
	expect(
		(await assessBrowserBackupRepresentability(room(), [], checksum)).kind,
	).toBe("representable");
	for (const kind of ["object", "array"] as const) {
		const project = room(),
			target = kind === "object" ? project.level : project.assetInstances;
		const prototype =
			kind === "object"
				? { retained: "prototype-data" }
				: Object.create(Array.prototype);
		Object.setPrototypeOf(target, prototype);
		expect(
			await assessBrowserBackupRepresentability(project, [], checksum),
		).toEqual(rejected);
		expect(Object.getPrototypeOf(target)).toBe(prototype);
	}
});
it("rejects hidden required data and array indices before legacy serialization changes their property descriptors", async () => {
	for (const kind of ["object", "array"] as const) {
		const project = room(),
			target = kind === "object" ? project : project.level.vertices,
			key = kind === "object" ? "name" : "0";
		const descriptor = Object.getOwnPropertyDescriptor(target, key);
		if (!descriptor) throw new Error("Required own data absent");
		Object.defineProperty(target, key, { ...descriptor, enumerable: false });
		expect(
			await assessBrowserBackupRepresentability(project, [], checksum),
		).toEqual(rejected);
		expect(Object.getOwnPropertyDescriptor(target, key)?.enumerable).toBe(
			false,
		);
	}
});

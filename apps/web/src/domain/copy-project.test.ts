import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "./initial-project";
import { copyProject } from "./copy-project";

describe("exact project snapshot", () => {
	it("retains historical non-index and non-enumerable array data so the registered codec can reject it without silent loss", () => {
		const project = createInitialProject({
			projectId: "p",
			levelId: "l",
			name: "Source",
			createdAt: "2026-11-04T12:00:00.000Z",
		});
		const marker = Symbol("historical-data");
		const note = { value: "source-only" };
		Object.defineProperty(project.assetInstances, "historical", {
			value: note,
			enumerable: true,
		});
		Object.defineProperty(project.assetInstances, marker, {
			value: note,
			enumerable: false,
		});
		Object.defineProperty(project.assetInstances, "self", {
			value: project.assetInstances,
			enumerable: false,
		});
		const copied = copyProject(project);
		expect(Reflect.ownKeys(copied.assetInstances)).toEqual(
			Reflect.ownKeys(project.assetInstances),
		);
		expect(Reflect.get(copied.assetInstances, "historical")).toEqual(note);
		expect(Reflect.get(copied.assetInstances, "historical")).not.toBe(note);
		expect(Reflect.get(copied.assetInstances, marker)).toBe(
			Reflect.get(copied.assetInstances, "historical"),
		);
		expect(Reflect.get(copied.assetInstances, "self")).toBe(
			copied.assetInstances,
		);
		expect(Reflect.get(project.assetInstances, "self")).toBe(
			project.assetInstances,
		);
	});
	it("owns all nested records while preserving negative zero, own undefined and UTF-16 values", () => {
		const project = {
			...createInitialProject({
				projectId: "p-\ud800",
				levelId: "l",
				name: "Source",
				createdAt: "2026-11-04T12:00:00.000Z",
			}),
			level: {
				levelId: "l",
				vertices: [{ vertexId: "v", xMm: -0, zMm: 0 }],
				wallSegments: [],
				openings: [],
				rooms: [
					{
						roomId: "r",
						heightMm: 2600,
						type: "other" as const,
						faceFingerprint: "face",
						name: undefined,
					},
				],
			},
		};
		const copied = copyProject(project);
		expect(copied).toEqual(project);
		expect(copied).not.toBe(project);
		expect(copied.level).not.toBe(project.level);
		expect(copied.level.vertices).not.toBe(project.level.vertices);
		expect(copied.level.vertices[0]).not.toBe(project.level.vertices[0]);
		expect(Object.is(copied.level.vertices[0].xMm, -0)).toBe(true);
		expect(Object.hasOwn(copied.level.rooms[0], "name")).toBe(true);
		expect(copied.projectId).toBe("p-\ud800");
		project.level.vertices[0].xMm = 10;
		expect(Object.is(copied.level.vertices[0].xMm, -0)).toBe(true);
	});
});

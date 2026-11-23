import { describe, expect, it } from "@rstest/core";
import { addConstrainedPartition } from "../domain/constrained-partition";
import { deriveBoundedOrthogonalFaces } from "../domain/derive-plan-faces";
import { createInitialProject } from "../domain/initial-project";
import { copyProject } from "../domain/copy-project";
import { yawRadiansFor } from "../domain/parametric-item";
import type {
	Project,
	FloorSchematicAssetInstance,
	WallSchematicAssetInstance,
} from "../domain/project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { validateRuntimeV1Project } from "./runtime-v1-project-validation";

const instant = "2026-11-04T12:00:00.000Z";
function empty(): Project {
	return createInitialProject({
		createdAt: instant,
		projectId: "source",
		levelId: "level",
		name: "Exact source",
	});
}
function ids(prefix = "id") {
	let index = 0;
	return { next: () => `${prefix}-${++index}` };
}
function starter(): Project {
	const configured = configureRectangularRoom(
		empty(),
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		ids(),
		instant,
	);
	if (configured.kind !== "accepted") throw new Error("Expected valid room");
	return configured.project;
}
function floor(
	project: Project,
	overrides: Partial<FloorSchematicAssetInstance> = {},
): FloorSchematicAssetInstance {
	return {
		anchorClass: "floor",
		assetInstanceId: "floor",
		roomId: project.level.rooms[0].roomId,
		label: "Chair",
		xMm: 1000,
		zMm: 1500,
		widthMm: 300,
		depthMm: 300,
		heightMm: 900,
		color: "#416b91",
		...overrides,
	};
}
function wallItem(
	project: Project,
	overrides: Partial<WallSchematicAssetInstance> = {},
): WallSchematicAssetInstance {
	return {
		anchorClass: "wall",
		assetInstanceId: "wall-item",
		wallSegmentId: project.level.wallSegments[1].wallSegmentId,
		side: "left",
		offsetMm: 1500,
		elevationMm: 1000,
		label: "Cabinet",
		widthMm: 300,
		depthMm: 100,
		heightMm: 600,
		color: "#416b91",
		...overrides,
	};
}
function freeze(value: unknown): void {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
	Object.freeze(value);
	for (const child of Object.values(value)) freeze(child);
}
function withObstacle(project: Project): Project {
	return {
		...project,
		level: {
			...project.level,
			vertices: [
				...project.level.vertices,
				{ vertexId: "obstacle-a", xMm: 2000, zMm: 1000 },
				{ vertexId: "obstacle-b", xMm: 2000, zMm: 2000 },
			],
			wallSegments: [
				...project.level.wallSegments,
				{
					wallSegmentId: "obstacle",
					startVertexId: "obstacle-a",
					endVertexId: "obstacle-b",
					thicknessMm: 100,
				},
			],
		},
	};
}
function diagonal(): Project {
	const project = empty();
	return {
		...project,
		level: {
			...project.level,
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 2000, zMm: 0 },
				{ vertexId: "c", xMm: 2000, zMm: 2000 },
			],
			wallSegments: [
				{
					wallSegmentId: "bottom",
					startVertexId: "a",
					endVertexId: "b",
					thicknessMm: 100,
				},
				{
					wallSegmentId: "right",
					startVertexId: "b",
					endVertexId: "c",
					thicknessMm: 100,
				},
				{
					wallSegmentId: "diagonal",
					startVertexId: "c",
					endVertexId: "a",
					thicknessMm: 100,
				},
			],
			rooms: [
				{
					roomId: "triangle",
					faceFingerprint: "orthogonal-face:0:0|2000:0|2000:2000",
					heightMm: 2600,
				},
			],
		},
	};
}

describe("read-only runtime V1 Project validation", () => {
	it.each([Number.MAX_VALUE, -Number.MAX_VALUE])(
		"checks every floor projection before any collision regardless of item order for %s",
		(yawRadians) => {
			const source = withObstacle(starter());
			const normal = floor(source, { assetInstanceId: "normal", xMm: 2000 });
			const unrenderable = floor(source, {
				assetInstanceId: "unrenderable-obstacle",
				yawRadians,
			});
			for (const assetInstances of [
				[normal, unrenderable],
				[unrenderable, normal],
			]) {
				const project = { ...source, assetInstances };
				freeze(project);
				expect(validateRuntimeV1Project(project)).toEqual({
					kind: "rejected",
					reasonCode: "INVALID_DIMENSION",
				});
				expect(unrenderable.yawRadians).toBe(yawRadians);
				expect(Object.hasOwn(unrenderable, "yawStep")).toBe(false);
			}
		},
	);
	it("keeps earlier schema and policy failures ahead of an unrenderable legacy orientation", () => {
		const source = starter();
		const item = floor(source, { yawRadians: Number.MAX_VALUE });
		expect(
			validateRuntimeV1Project({
				...source,
				assetInstances: [{ ...item, color: "invalid" }],
			}),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
		const assetDefinitionRefs = Array.from({ length: 101 }, (_, index) => ({
			assetDefinitionId: `definition-${index}`,
			displayName: "Resource",
			format: "glb" as const,
			resourceHash: index.toString(16).padStart(64, "0"),
			byteLength: 1,
			widthMm: 1,
			depthMm: 1,
			heightMm: 1,
		}));
		expect(
			validateRuntimeV1Project({
				...source,
				assetDefinitionRefs,
				assetInstances: [item],
			}),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_PROJECT_LIMIT" });
	});
	it("accepts empty and open drawings without inventing Room metadata or changing source identity", () => {
		const source = empty();
		const open = {
			...source,
			level: {
				...source.level,
				vertices: [
					{ vertexId: "a", xMm: -0, zMm: 0 },
					{ vertexId: "b", xMm: 1000, zMm: 0 },
				],
				wallSegments: [
					{
						wallSegmentId: "open",
						startVertexId: "a",
						endVertexId: "b",
						thicknessMm: 100,
					},
				],
			},
		};
		for (const project of [source, open]) {
			freeze(project);
			const result = validateRuntimeV1Project(project);
			expect(result.kind).toBe("accepted");
			if (result.kind !== "accepted") throw new Error("Expected valid drawing");
			expect(result.project).toBe(project);
		}
		expect(Object.is(open.level.vertices[0].xMm, -0)).toBe(true);
	});
	it("accepts bound multiroom and octilinear plans through the existing core", () => {
		const source = starter();
		const partitioned = addConstrainedPartition(
			source,
			{ orientation: "vertical", offsetMm: 2000 },
			ids("partition"),
			instant,
		);
		if (partitioned.kind !== "accepted") throw new Error("Expected two rooms");
		for (const project of [source, partitioned.project, diagonal()]) {
			freeze(project);
			const result = validateRuntimeV1Project(project);
			expect(result).toEqual({ kind: "accepted", project });
			if (result.kind === "accepted") expect(result.project).toBe(project);
		}
	});
	it("accepts wall/floor hosts and exact Door/Window addresses without adding IDs or materializing defaults", () => {
		const source = starter();
		const project = {
			...source,
			assetInstances: [floor(source), wallItem(source)],
			level: {
				...source.level,
				openings: [
					{
						openingId: "door",
						kind: "Door" as const,
						wallSegmentId: source.level.wallSegments[0].wallSegmentId,
						offsetMm: 2500,
						widthMm: 900,
						heightMm: 2100,
						sillMm: -0,
						swingSide: undefined,
					},
					{
						openingId: "window",
						kind: "Window" as const,
						wallSegmentId: source.level.wallSegments[2].wallSegmentId,
						offsetMm: 2500,
						widthMm: 1000,
						heightMm: 1200,
						sillMm: 900,
						swingSide: undefined,
					},
				],
			},
		};
		const before = copyProject(project);
		freeze(project);
		expect(validateRuntimeV1Project(project)).toEqual({
			kind: "accepted",
			project,
		});
		expect(project).toEqual(before);
		expect(Object.is(project.level.openings[0].sillMm, -0)).toBe(true);
		expect(Object.hasOwn(project.level.openings[0], "swingSide")).toBe(true);
		expect(project.level.openings[0].swingSide).toBeUndefined();
	});
	it("retains confirmed item-overlap and Door-clearance warnings as accepted geometry", () => {
		const source = starter();
		const first = floor(source, { xMm: 700, zMm: 650 });
		const project = {
			...source,
			assetInstances: [
				first,
				{ ...first, assetInstanceId: "overlap" },
				wallItem(source),
				wallItem(source, { assetInstanceId: "overlapping-wall" }),
			],
			level: {
				...source.level,
				openings: [
					{
						openingId: "door",
						kind: "Door" as const,
						wallSegmentId: source.level.wallSegments[0].wallSegmentId,
						offsetMm: 1000,
						widthMm: 900,
						heightMm: 2100,
						sillMm: 0,
						swingSide: "left" as const,
					},
				],
			},
		};
		freeze(project);
		expect(validateRuntimeV1Project(project)).toEqual({
			kind: "accepted",
			project,
		});
	});
	it("preserves nested variant arrays, own undefined and legacy yaw instead of normalizing the accepted Project", () => {
		const source = starter();
		const item = {
			...floor(source),
			colorVariantId: [["alpha-blue"]],
			assetDefinitionId: undefined,
			elevationMm: -0,
			yawStep: undefined,
			yawRadians: 0.5,
			locked: undefined,
		};
		const project = {
			...source,
			assetInstances: [item],
			level: {
				...source.level,
				vertices: source.level.vertices.map((vertex, index) =>
					index ? vertex : { ...vertex, xMm: -0, zMm: -0 },
				),
				rooms: source.level.rooms.map((room) => ({
					...room,
					name: undefined,
					type: undefined,
				})),
			},
		};
		freeze(project);
		const result = validateRuntimeV1Project(project);
		expect(result.kind).toBe("accepted");
		if (result.kind !== "accepted")
			throw new Error("Expected exact legacy shape");
		expect(result.project).toBe(project);
		expect(project.assetInstances[0]).toBe(item);
		expect(item.colorVariantId).toEqual([["alpha-blue"]]);
		expect(Object.hasOwn(item, "yawStep")).toBe(true);
		expect(item.yawStep).toBeUndefined();
		expect(item.yawRadians).toBe(0.5);
		expect(Object.is(item.elevationMm, -0)).toBe(true);
	});
	it.each([0.5, -1e100, 1e100])(
		"uses the existing disposable legacy orientation for finite yaw %s without changing it",
		(yawRadians) => {
			const source = starter();
			const item = floor(source, { yawRadians });
			const project = { ...source, assetInstances: [item] };
			freeze(project);
			expect(validateRuntimeV1Project(project)).toEqual({
				kind: "accepted",
				project,
			});
			expect(item.yawRadians).toBe(yawRadians);
			expect(Object.hasOwn(item, "yawStep")).toBe(false);
			const obstacle = withObstacle(source);
			const collision = {
				...obstacle,
				assetInstances: [floor(obstacle, { xMm: 2000, yawRadians })],
			};
			freeze(collision);
			expect(validateRuntimeV1Project(collision)).toEqual({
				kind: "rejected",
				reasonCode: "WALL_ITEM_COLLISION",
			});
		},
	);
	it("honours explicit yawStep over even a finite legacy angle that its historical projection cannot render alone", () => {
		const source = starter();
		const item = floor(source, { yawStep: 2, yawRadians: Number.MAX_VALUE });
		const project = { ...source, assetInstances: [item] };
		freeze(project);
		expect(validateRuntimeV1Project(project)).toEqual({
			kind: "accepted",
			project,
		});
		expect(item.yawStep).toBe(2);
		expect(item.yawRadians).toBe(Number.MAX_VALUE);
	});
	it.each([Number.MAX_VALUE, -Number.MAX_VALUE])(
		"reports unrenderable derived orientation for finite %s as a domain failure without replacing the source",
		(yawRadians) => {
			const source = starter();
			const item = floor(source, { yawRadians });
			const project = { ...source, assetInstances: [item] };
			freeze(project);
			expect(Number.isNaN(yawRadiansFor(item))).toBe(true);
			expect(validateRuntimeV1Project(project)).toEqual({
				kind: "rejected",
				reasonCode: "INVALID_DIMENSION",
			});
			expect(item.yawRadians).toBe(yawRadians);
			expect(Object.hasOwn(item, "yawStep")).toBe(false);
		},
	);
	it("keeps malformed shape separate from policy and later kernel rejection", () => {
		expect(validateRuntimeV1Project({})).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_SCHEMA_UNREADABLE",
		});
		const source = empty();
		const definitions = Array.from({ length: 101 }, (_, i) => ({
			assetDefinitionId: `d-${i}`,
			displayName: "Resource",
			format: "glb" as const,
			resourceHash: i.toString(16).padStart(64, "0"),
			byteLength: 1,
			widthMm: 1,
			depthMm: 1,
			heightMm: 1,
		}));
		expect(
			validateRuntimeV1Project({ ...source, assetDefinitionRefs: definitions }),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_PROJECT_LIMIT" });
		expect(
			validateRuntimeV1Project({
				...source,
				assetDefinitionRefs: definitions.slice(0, 100),
			}).kind,
		).toBe("accepted");
	});
	it.each([50 * 1024 * 1024 + 1, Number.MAX_SAFE_INTEGER])(
		"enforces the existing per-resource policy before geometry for %s bytes",
		(byteLength) => {
			const source = empty();
			const project = {
				...source,
				assetDefinitionRefs: [
					{
						assetDefinitionId: "d",
						displayName: "Resource",
						format: "glb" as const,
						resourceHash: "a".repeat(64),
						byteLength,
						widthMm: 1,
						depthMm: 1,
						heightMm: 1,
					},
				],
			};
			expect(validateRuntimeV1Project(project)).toEqual({
				kind: "rejected",
				reasonCode: "BACKUP_PROJECT_LIMIT",
			});
		},
	);
	it("enforces the existing summed resource budget and wall length policy without allocating resources", () => {
		const source = empty();
		const refs = Array.from({ length: 4 }, (_, i) => ({
			assetDefinitionId: `d-${i}`,
			displayName: "Resource",
			format: "glb" as const,
			resourceHash: i.toString(16).padStart(64, "0"),
			byteLength: 50 * 1024 * 1024,
			widthMm: 1,
			depthMm: 1,
			heightMm: 1,
		}));
		expect(
			validateRuntimeV1Project({ ...source, assetDefinitionRefs: refs }),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_PROJECT_LIMIT" });
		for (const end of [
			{ xMm: 100000, zMm: 100000 },
		]) {
			const project = {
				...source,
				level: {
					...source.level,
					vertices: [
						{ vertexId: "a", xMm: 0, zMm: 0 },
						{ vertexId: "b", ...end },
					],
					wallSegments: [
						{
							wallSegmentId: "wall",
							startVertexId: "a",
							endVertexId: "b",
							thicknessMm: 100,
						},
					],
				},
			};
			expect(validateRuntimeV1Project(project)).toEqual({
				kind: "rejected",
				reasonCode: "BACKUP_PROJECT_LIMIT",
			});
		}
	});
	it("preserves the original stable PlanGraph and Room-binding reasons", () => {
		const source = empty();
		const graph = {
			...source,
			level: {
				...source.level,
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "b", xMm: 1000, zMm: 500 },
				],
				wallSegments: [
					{
						wallSegmentId: "wrong-direction",
						startVertexId: "a",
						endVertexId: "b",
						thicknessMm: 100,
					},
				],
			},
		};
		expect(deriveBoundedOrthogonalFaces(graph.level)).toEqual({
			kind: "rejected",
			reasonCode: "NON_ORTHOGONAL_WALL",
		});
		expect(validateRuntimeV1Project(graph)).toEqual({
			kind: "rejected",
			reasonCode: "NON_ORTHOGONAL_WALL",
		});
		const room = starter();
		expect(
			validateRuntimeV1Project({
				...room,
				level: {
					...room.level,
					rooms: room.level.rooms.map((value) => ({
						...value,
						faceFingerprint: "wrong",
					})),
				},
			}),
		).toEqual({
			kind: "rejected",
			reasonCode: "ROOM_FACE_RECONCILIATION_FAILED",
		});
	});
	it("keeps exact opening guard reasons and excludes only the current durable opening from overlap checks", () => {
		const source = starter();
		const door = {
			openingId: "door",
			kind: "Door" as const,
			wallSegmentId: source.level.wallSegments[0].wallSegmentId,
			offsetMm: 1000,
			widthMm: 900,
			heightMm: 2100,
			sillMm: 0,
		};
		for (const [change, reasonCode] of [
			[{ widthMm: 799 }, "DOOR_WIDTH_BELOW_MINIMUM"],
			[{ offsetMm: 449 }, "OPENING_OUTSIDE_WALL_INTERVAL"],
			[{ heightMm: 2601 }, "OPENING_OUT_OF_BOUNDS"],
		] as const)
			expect(
				validateRuntimeV1Project({
					...source,
					level: { ...source.level, openings: [{ ...door, ...change }] },
				}),
			).toEqual({ kind: "rejected", reasonCode });
		expect(
			validateRuntimeV1Project({
				...source,
				level: {
					...source.level,
					openings: [door, { ...door, openingId: "overlap", offsetMm: 1800 }],
				},
			}),
		).toEqual({ kind: "rejected", reasonCode: "OPENING_OVERLAP" });
	});
	it("preserves blocking floor/wall host and footprint outcomes", () => {
		const source = starter();
		expect(
			validateRuntimeV1Project({
				...source,
				assetInstances: [floor(source, { xMm: 10 })],
			}),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_ROOM_HOST" });
		expect(
			validateRuntimeV1Project({
				...source,
				assetInstances: [wallItem(source, { offsetMm: 0 })],
			}),
		).toEqual({ kind: "rejected", reasonCode: "OUTSIDE_WALL_HOST" });
	});
});

describe("runtime V1 policy and binding boundaries", () => {
	it("does not treat a closed face without Room metadata or a phantom Room without a face as an empty drawing", () => {
		const source = starter();
		expect(
			validateRuntimeV1Project({
				...source,
				level: { ...source.level, rooms: [] },
			}),
		).toEqual({ kind: "rejected", reasonCode: "EMPTY_PLAN" });
		const initial = empty();
		expect(
			validateRuntimeV1Project({
				...initial,
				level: { ...initial.level, rooms: source.level.rooms },
			}),
		).toEqual({ kind: "rejected", reasonCode: "EMPTY_PLAN" });
	});
	it("uses the Window guard for narrow valid windows and preserves unsupported open-wall host failure", () => {
		const source = starter();
		const opening = {
			openingId: "narrow-window",
			kind: "Window" as const,
			wallSegmentId: source.level.wallSegments[0].wallSegmentId,
			offsetMm: 1000,
			widthMm: 200,
			heightMm: 1000,
			sillMm: 500,
		};
		expect(
			validateRuntimeV1Project({
				...source,
				level: { ...source.level, openings: [opening] },
			}).kind,
		).toBe("accepted");
		const initial = empty();
		const open = {
			...initial,
			level: {
				...initial.level,
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "b", xMm: 2000, zMm: 0 },
				],
				wallSegments: [
					{
						wallSegmentId: opening.wallSegmentId,
						startVertexId: "a",
						endVertexId: "b",
						thicknessMm: 100,
					},
				],
				openings: [opening],
			},
		};
		expect(validateRuntimeV1Project(open)).toEqual({
			kind: "rejected",
			reasonCode: "INVALID_WALL_HOST",
		});
	});
	it("accepts the exact per-resource and summed policy bounds without allocating or reading payloads", () => {
		const source = empty();
		const definition = (byteLength: number, index: number) => ({
			assetDefinitionId: `d-${index}`,
			displayName: "Resource",
			format: "glb" as const,
			resourceHash: index.toString(16).padStart(64, "0"),
			byteLength,
			widthMm: 1,
			depthMm: 1,
			heightMm: 1,
		});
		expect(
			validateRuntimeV1Project({
				...source,
				assetDefinitionRefs: [definition(50 * 1024 * 1024, 0)],
			}).kind,
		).toBe("accepted");
		expect(
			validateRuntimeV1Project({
				...source,
				assetDefinitionRefs: [50, 50, 50, 30].map((size, index) =>
					definition(size * 1024 * 1024, index),
				),
			}).kind,
		).toBe("accepted");
	});
	it("accepts exact nonzero wall length bounds and translated coordinates, while preserving an earlier zero-length structural failure", () => {
		const source = empty();
		for (const [start, end] of [
			[
				{ xMm: 0, zMm: 0 },
				{ xMm: 1, zMm: 0 },
			],
			[
				{ xMm: 0, zMm: 0 },
				{ xMm: 49, zMm: 0 },
			],
			[
				{ xMm: 0, zMm: 0 },
				{ xMm: 50, zMm: 0 },
			],
			[
				{ xMm: 0, zMm: 0 },
				{ xMm: 100000, zMm: 0 },
			],
			[
				{ xMm: 99900, zMm: 99900 },
				{ xMm: 100000, zMm: 99900 },
			],
			[
				{ xMm: 99900, zMm: 99900 },
				{ xMm: 99900, zMm: 100000 },
			],
		]) {
			const project = {
				...source,
				level: {
					...source.level,
					vertices: [
						{ vertexId: "a", ...start },
						{ vertexId: "b", ...end },
					],
					wallSegments: [
						{
							wallSegmentId: "wall",
							startVertexId: "a",
							endVertexId: "b",
							thicknessMm: 100,
						},
					],
				},
			};
			expect(validateRuntimeV1Project(project).kind).toBe("accepted");
		}
		expect(
			validateRuntimeV1Project({
				...source,
				level: {
					...source.level,
					vertices: [
						{ vertexId: "a", xMm: 0, zMm: 0 },
						{ vertexId: "b", xMm: -0, zMm: 0 },
					],
					wallSegments: [
						{
							wallSegmentId: "zero",
							startVertexId: "a",
							endVertexId: "b",
							thicknessMm: 100,
						},
					],
				},
			}),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
	});
	it("accepts the exact 600-vertex and 300-wall limits as a valid open drawing", () => {
		const source = empty();
		const vertices = Array.from({ length: 300 }, (_, index) => [
			{ vertexId: `a-${index}`, xMm: 0, zMm: index * 100 },
			{ vertexId: `b-${index}`, xMm: 50, zMm: index * 100 },
		]).flat();
		const wallSegments = Array.from({ length: 300 }, (_, index) => ({
			wallSegmentId: `w-${index}`,
			startVertexId: `a-${index}`,
			endVertexId: `b-${index}`,
			thicknessMm: 100,
		}));
		const project = {
			...source,
			level: { ...source.level, vertices, wallSegments },
		};
		expect(validateRuntimeV1Project(project).kind).toBe("accepted");
	});
	it("accepts 50 exactly bound detached Rooms", () => {
		const source = empty();
		const loops = Array.from({ length: 50 }, (_, index) => {
			const x = (index % 10) * 2000,
				z = Math.floor(index / 10) * 2000;
			const vertices = [
				{ vertexId: `a-${index}`, xMm: x, zMm: z },
				{ vertexId: `b-${index}`, xMm: x + 1000, zMm: z },
				{ vertexId: `c-${index}`, xMm: x + 1000, zMm: z + 1000 },
				{ vertexId: `d-${index}`, xMm: x, zMm: z + 1000 },
			];
			return {
				vertices,
				walls: vertices.map((vertex, part) => ({
					wallSegmentId: `w-${index}-${part}`,
					startVertexId: vertex.vertexId,
					endVertexId: vertices[(part + 1) % 4].vertexId,
					thicknessMm: 100,
				})),
				room: {
					roomId: `room-${index}`,
					faceFingerprint: `loop:${x}:${x + 1000}:${z}:${z + 1000}:100`,
					heightMm: 2600,
				},
			};
		});
		const project = {
			...source,
			level: {
				...source.level,
				vertices: loops.flatMap((loop) => loop.vertices),
				wallSegments: loops.flatMap((loop) => loop.walls),
				rooms: loops.map((loop) => loop.room),
			},
		};
		expect(validateRuntimeV1Project(project).kind).toBe("accepted");
	});
	it("accepts the exact 200 Opening limit with disjoint narrow Windows", () => {
		const source = starter();
		const openings = Array.from({ length: 200 }, (_, index) => ({
			openingId: `window-${index}`,
			kind: "Window" as const,
			wallSegmentId: source.level.wallSegments[0].wallSegmentId,
			offsetMm: 100 + index * 15,
			widthMm: 10,
			heightMm: 100,
			sillMm: 100,
		}));
		expect(
			validateRuntimeV1Project({
				...source,
				level: { ...source.level, openings },
			}).kind,
		).toBe("accepted");
	});
	it("accepts the exact 250 item limit including retained wall-overlap warnings", () => {
		const source = starter();
		const assetInstances = Array.from({ length: 250 }, (_, index) =>
			wallItem(source, { assetInstanceId: `wall-item-${index}` }),
		);
		expect(validateRuntimeV1Project({ ...source, assetInstances }).kind).toBe(
			"accepted",
		);
	});
});

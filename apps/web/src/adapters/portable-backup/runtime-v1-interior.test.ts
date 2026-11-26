import { expect, it } from "@rstest/core";
import { serializeProjectCanonically } from "../../domain/canonical-serialization";
import { parseCustomWallFinish, wallFinishColor } from "../../domain/interior-materials";
import { applyInteriorCommand } from "../../domain/interior-project";
import { isStructurallyValidTelegramProject } from "../../domain/project-json-transfer";
import type { Project } from "../../domain/project";
import { sameWallSurfaceMetadata, wallSurfaceMetadata } from "../../domain/wall-surface-metadata";
import { RuntimePortableBackupCodec } from "./runtime-portable-backup-codec";
import {
	decodeRegisteredRuntimeV1Project,
	decodeRuntimeV1Project,
	encodeRegisteredRuntimeProject,
} from "./runtime-v1-wire";

const schemaId = "interiors.project/runtime-v1-interior-details";
const layoutSchemaId = "interiors.project/runtime-v1-room-layouts";
const wallColorSchemaId = "interiors.project/runtime-v1-wall-colors";
const project = {
	schemaVersion: 1,
	interiorSchemaVersion: 1,
	projectId: "project",
	name: "Гостиная",
	createdAt: "2026-11-26T00:00:00.000Z",
	updatedAt: "2026-11-26T00:00:00.000Z",
	lifecycle: "active",
	level: {
		levelId: "level",
		vertices: [{ vertexId: "a", xMm: 0, zMm: 0 }, { vertexId: "b", xMm: 2500, zMm: 0 }],
		wallSegments: [{
			wallSegmentId: "wall", startVertexId: "a", endVertexId: "b", thicknessMm: 200,
			profile: "bearing", sideFinishes: { left: { presetId: "sand-paint", version: 1 } },
		}],
		rooms: [{
			roomId: "living", faceFingerprint: "room-face", heightMm: 2700,
			floorFinish: { presetId: "light-oak", version: 1 },
		}],
		openings: [{
			openingId: "door", wallSegmentId: "wall", offsetMm: 700,
			widthMm: 900, heightMm: 2100, sillMm: 0, kind: "Door",
			variant: "sliding", slideSide: "left", slideDirection: "toward-end",
		}],
	},
	roomLayouts: [{ layoutId: "living-a", roomId: "living", slot: "A", name: "Утро" }],
	assetInstances: [{
		assetInstanceId: "host", label: "Тумбочка", anchorClass: "floor", roomId: "living", roomLayoutId: "living-a",
		xMm: 1500, zMm: 800, widthMm: 500, depthMm: 400, heightMm: 600, color: "#8c6e4c",
		yawMilliDeg: 37500, catalogPreset: { presetId: "bedside-table", version: 1 },
	}],
	supportedItems: [{
		assetInstanceId: "guest", label: "Кашпо", anchorClass: "support",
		widthMm: 350, depthMm: 350, heightMm: 450, color: "#416b91", colorVariantId: "alpha-blue",
		catalogPreset: { presetId: "planter", version: 1 },
		supportAssetInstanceId: "host", supportSurfaceKey: "top", offsetXMm: 40, offsetZMm: 0, relativeYawMilliDeg: 0,
	}],
	assetDefinitionRefs: [],
} as const;

function codeResidentMember(value: unknown): string {
	const encoded = encodeRegisteredRuntimeProject(value);
	if (encoded.kind !== "encoded") throw new Error("Expected an encodable project");
	return new TextDecoder().decode(encoded.bytes);
}

function withCustomWallColor(color = "#1b2c3d") {
	const wall = project.level.wallSegments[0];
	return { ...project, interiorSchemaVersion: 2, level: { ...project.level, wallSegments: [{
		...wall, sideFinishes: { ...wall.sideFinishes, right: { color, version: 2 } },
	}] } };
}

it("normalizes an entered hex color and resolves its exact swatch alongside an existing preset", () => {
	const finish = parseCustomWallFinish(" 2Ac4eF ");
	expect(finish).toEqual({ color: "#2ac4ef", version: 2 });
	if (!finish) throw Error("Expected a valid input color");
	expect(wallFinishColor(finish)).toBe("#2ac4ef");
	expect(wallFinishColor(project.level.wallSegments[0].sideFinishes.left)).toBe("#c7ad8f");
	expect(parseCustomWallFinish("#234567")).toEqual({ color: "#234567", version: 2 });
	for (const invalid of ["", "#fff", "##2ac4ef", "#2ac4eg", "#2ac4ef0"]) {
		expect(parseCustomWallFinish(invalid)).toBeUndefined();
	}
});

it("records a custom color for one physical wall face and only changes the selector while it is present", () => {
	const { supportedItems: _guests, ...room } = project;
	const initial: Project = { ...room, assetInstances: [] };
	const finish = { color: "#1b2c3d", version: 2 } as const;
	const edit = (snapshot: Project, candidate: unknown) => applyInteriorCommand(snapshot, {
		kind: "set-wall-finish", wallSegmentId: "wall", side: "right", finish: candidate,
	} as Parameters<typeof applyInteriorCommand>[1], { next: () => "unused" }, project.updatedAt);
	const result = edit(initial, finish);
	if (result.kind !== "accepted") throw Error("Expected a durable wall color candidate");
	expect(result.project).toMatchObject({ interiorSchemaVersion: 2, level: { wallSegments: withCustomWallColor().level.wallSegments } });
	expect(isStructurallyValidTelegramProject(result.project)).toBe(true);
	expect(edit(result.project, finish)).toMatchObject({ kind: "unchanged" });
	for (const invalid of [
		null, "red", { ...finish, color: "#abcdefg" }, { ...finish, color: "#AABBCC" },
		{ ...finish, presetId: "sand-paint" }, { presetId: "sand-paint", version: 3 },
		{ presetId: "missing", version: 1 }, { color: "#abcdef", invalidVersion: 2 },
		Object.assign(Object.create({ color: "#abcdef" }), { version: 2, extra: true }),
		Object.defineProperty({ version: 2 }, "color", { value: "#abcdef", enumerable: false }),
	]) expect(edit(result.project, invalid)).toMatchObject({ kind: "rejected" });
	const [wall] = result.project.level.wallSegments;
	expect(wallSurfaceMetadata(wall!, true)).toMatchObject({ sideFinishes: { left: finish, right: { presetId: "sand-paint" } } });
	const otherColor = { ...wall!, sideFinishes: { ...wall!.sideFinishes, right: { color: "#abcdef", version: 2 as const } } };
	expect(sameWallSurfaceMetadata(wall!, otherColor, false)).toBe(false);
	const cleared = edit(result.project, undefined);
	if (cleared.kind !== "accepted") throw Error("Expected reset to remove only the chosen assignment");
	expect(serializeProjectCanonically(cleared.project)).toBe(serializeProjectCanonically(initial));
	expect(encodeRegisteredRuntimeProject(cleared.project)).toMatchObject({ kind: "encoded", projectSchemaId: schemaId });
});

it("round-trips a custom wall color with the old furniture/layout graph using the new selector only", () => {
	const custom = withCustomWallColor();
	const encoded = encodeRegisteredRuntimeProject(custom);
	if (encoded.kind !== "encoded") throw Error("Expected a portable wall color member");
	expect(encoded.projectSchemaId).toBe(wallColorSchemaId);
	expect(decodeRegisteredRuntimeV1Project(encoded.bytes, encoded.projectSchemaId))
		.toMatchObject({ kind: "decoded", project: custom });
	const oldMember = new TextEncoder().encode(codeResidentMember(project));
	expect(decodeRegisteredRuntimeV1Project(oldMember, encoded.projectSchemaId)).toMatchObject({ kind: "rejected" });
	const customLabel = codeResidentMember(project).replace(schemaId, wallColorSchemaId);
	expect(decodeRegisteredRuntimeV1Project(new TextEncoder().encode(customLabel), encoded.projectSchemaId)).toMatchObject({ kind: "rejected" });
	expect(decodeRegisteredRuntimeV1Project(encoded.bytes, schemaId)).toMatchObject({ kind: "rejected" });
	const legacyLabel = new TextDecoder().decode(encoded.bytes).replace(wallColorSchemaId, schemaId);
	expect(decodeRegisteredRuntimeV1Project(new TextEncoder().encode(legacyLabel), schemaId)).toMatchObject({ kind: "rejected" });
	for (const invalidColor of ["#EF1234", "#abc", "transparent", "#112233\\n"]) {
		expect(isStructurallyValidTelegramProject(withCustomWallColor(invalidColor))).toBe(false);
		expect(encodeRegisteredRuntimeProject(withCustomWallColor(invalidColor))).toMatchObject({ kind: "rejected" });
	}
	expect(isStructurallyValidTelegramProject({ ...custom, interiorSchemaVersion: 1 })).toBe(false);
	expect(encodeRegisteredRuntimeProject({ ...custom, interiorSchemaVersion: 1 })).toMatchObject({ kind: "rejected" });
	const { interiorSchemaVersion: _required, ...unmarked } = custom;
	expect(isStructurallyValidTelegramProject(unmarked)).toBe(false);
	expect(encodeRegisteredRuntimeProject(unmarked)).toMatchObject({ kind: "rejected" });
});

it("selects the registered interior member and preserves the derived host context across representations", () => {
	const text = codeResidentMember(project);
	expect(JSON.parse(text)).toMatchObject({
		projectSchemaId: schemaId,
		assetInstances: [
			{ assetInstanceId: "host" },
			{ assetInstanceId: "guest", context: { roomId: "living", layoutId: "living-a" } },
		],
	});
	expect(JSON.parse(text)).not.toHaveProperty("interiorSchemaVersion");
	expect(JSON.parse(text)).not.toHaveProperty("supportedItems");
	const bytes = new TextEncoder().encode(text);
	expect(decodeRegisteredRuntimeV1Project(bytes, schemaId as Parameters<typeof decodeRegisteredRuntimeV1Project>[1]))
		.toMatchObject({ kind: "decoded", project });
	expect(decodeRuntimeV1Project(bytes)).toMatchObject({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });

	const local = JSON.parse(serializeProjectCanonically(project as unknown as Project));
	expect(local).toMatchObject({ interiorSchemaVersion: 1, roomLayouts: project.roomLayouts, assetInstances: [
		{ assetInstanceId: "host" },
		{ assetInstanceId: "guest", context: { roomId: "living", layoutId: "living-a" } },
	] });
	expect(local).not.toHaveProperty("supportedItems");
});

it("rejects a mismatched host context, mixed door controls, and noncanonical new numbers", () => {
	const text = codeResidentMember(project);
	for (const invalid of [
		text.replace('"layoutId":"living-a"}}', '"layoutId":"other-layout"}}'),
		text.replace('"roomId":"living","layoutId":"living-a"}', '"roomId":"other-room","layoutId":"living-a"}'),
		text.replace('"variant":"sliding"', '"variant":"sliding","swingSide":"left"'),
		text.replace('"offsetXMm":40', '"offsetXMm":40.0'),
		text.replace('"offsetXMm":40', '"offsetXMm":-0'),
		text.replace('"supportSurfaceKey":"top"', '"supportSurfaceKey":"unknown"'),
	]) {
		expect(invalid).not.toBe(text);
		expect(decodeRegisteredRuntimeV1Project(
			new TextEncoder().encode(invalid), schemaId as Parameters<typeof decodeRegisteredRuntimeV1Project>[1],
		)).toMatchObject({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
	}
});

it("recognizes every interior field before the local marker is derived", () => {
	const source = {
		schemaVersion: project.schemaVersion, projectId: project.projectId, name: project.name,
		createdAt: project.createdAt, updatedAt: project.updatedAt, lifecycle: project.lifecycle,
		assetInstances: [], assetDefinitionRefs: [],
	};
	const [{ profile, sideFinishes, ...wall }] = project.level.wallSegments;
	const [{ floorFinish, ...room }] = project.level.rooms;
	const [{ roomLayoutId: _layout, catalogPreset, ...host }] = project.assetInstances;
	const level = { ...project.level, wallSegments: [wall], rooms: [room], openings: [] };
	for (const fixture of [
		{ ...source, level: { ...level, wallSegments: [{ ...wall, profile }] } },
		{ ...source, level: { ...level, wallSegments: [{ ...wall, sideFinishes }] } },
		{ ...source, level: { ...level, rooms: [{ ...room, floorFinish }] } },
		{ ...source, level: { ...level, openings: project.level.openings } },
		{ ...source, level: { ...level, openings: [{ openingId: "window", wallSegmentId: "wall", kind: "Window",
			offsetMm: 600, widthMm: 1200, heightMm: 900, sillMm: 800, sections: 2 }] } },
		{ ...source, level, assetInstances: [{ ...host, catalogPreset }] },
		{ ...source, level, assetInstances: [{ ...host, catalogPreset }], supportedItems: project.supportedItems },
	]) {
		expect(JSON.parse(codeResidentMember(fixture))).toMatchObject({ projectSchemaId: schemaId });
	}
	const portable = JSON.parse(codeResidentMember({
		...source, level, assetInstances: [{ ...host, catalogPreset }], supportedItems: project.supportedItems,
	}));
	expect(portable.assetInstances[1].context).toEqual({ roomId: "living" });
});

it("refuses contradictory support and local-marker representations at the encoder boundary", () => {
	const guest = project.supportedItems[0];
	const rawSupport = JSON.parse(codeResidentMember(project)).assetInstances[1];
	for (const fixture of [
		{ ...project, interiorSchemaVersion: 2 },
		{ ...project, interiorSchemaVersion: 3 },
		{ ...project, interiorSchemaVersion: undefined },
		{ ...project, supportedItems: [] },
		{ ...project, supportedItems: [{ ...guest, context: rawSupport.context }] },
		{ ...project, supportedItems: [{ ...guest, supportAssetInstanceId: "missing" }] },
		{ ...project, assetInstances: [project.assetInstances[0], rawSupport], supportedItems: undefined },
	]) {
		expect(encodeRegisteredRuntimeProject(fixture)).toMatchObject({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
	}
});

it("uses the room layout selector when there is no interior data", () => {
	const fixture = {
		schemaVersion: 1, projectId: "layout-only", name: "A/B",
		createdAt: project.createdAt, updatedAt: project.updatedAt, lifecycle: "active",
		level: { ...project.level, wallSegments: [], openings: [], rooms: [{ roomId: "living", faceFingerprint: "room-face", heightMm: 2700 }] },
		roomLayouts: project.roomLayouts, assetInstances: [], assetDefinitionRefs: [],
	};
	expect(JSON.parse(codeResidentMember(fixture))).toMatchObject({ projectSchemaId: layoutSchemaId });
});

it("admits the interior archive only through an opted-in codec", async () => {
	const checksum = {
		async sha256Bytes(bytes: Uint8Array) {
			const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
			return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
		},
	};
	const accept = () => ({ kind: "accepted" as const });
	const input = { project, createdAt: project.createdAt, resources: [] };
	const legacy = new RuntimePortableBackupCodec(checksum, accept);
	const extended = new RuntimePortableBackupCodec(checksum, accept, true);
	const { interiorSchemaVersion: _marker, supportedItems: _items, ...remaining } = project;
	const layoutOnly = { ...remaining, assetInstances: [], level: { ...project.level, rooms: [
		{ roomId: "living", faceFingerprint: "room-face", heightMm: 2700 },
	], wallSegments: [], openings: [] } };
	expect(await legacy.encode({ ...input, project: layoutOnly })).toMatchObject({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
	const layoutArchive = await extended.encode({ ...input, project: layoutOnly });
	if (layoutArchive.kind !== "encoded") throw new Error(`Expected a layout archive: ${layoutArchive.reasonCode}`);
	expect(await extended.decode(layoutArchive.bytes)).toMatchObject({ kind: "decoded", schema: "runtime-v1-room-layouts" });
	const { roomLayouts: _layouts, ...old } = layoutOnly;
	expect(await legacy.encode({ ...input, project: old })).toMatchObject({ kind: "encoded" });
	const archive = await extended.encode(input);
	if (archive.kind !== "encoded") throw new Error(`Expected an interior archive: ${archive.reasonCode}`);
	expect(await legacy.encode(input)).toMatchObject({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
	expect(await legacy.decode(archive.bytes)).toMatchObject({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
	expect(await extended.decode(archive.bytes)).toMatchObject({ kind: "decoded", schema: "runtime-v1-interior-details", decodedProject: project });
	const custom = withCustomWallColor();
	const customArchive = await extended.encode({ ...input, project: custom });
	if (customArchive.kind !== "encoded") throw new Error(`Expected a custom wall archive: ${customArchive.reasonCode}`);
	expect(await legacy.encode({ ...input, project: custom })).toMatchObject({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
	expect(await legacy.decode(customArchive.bytes)).toMatchObject({ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" });
	expect(await extended.decode(customArchive.bytes)).toMatchObject({ kind: "decoded", schema: "runtime-v1-wall-colors",
		metadata: { projectSchemaId: wallColorSchemaId, projectSchemaVersion: 1 }, decodedProject: custom });
});

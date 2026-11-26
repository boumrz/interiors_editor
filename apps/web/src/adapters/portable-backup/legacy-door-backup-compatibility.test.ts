import { describe, expect, it } from "@rstest/core";
import { canonicalProjectSerializer } from "../../application/create-project";
import { ExportPortableBackupUseCase } from "../../application/export-portable-backup";
import { ImportPortableBackupUseCase } from "../../application/import-portable-backup";
import { addDoorOpeningToProject } from "../../domain/door-opening-project";
import type { Project } from "../../domain/project";
import { createInitialProject } from "../../domain/initial-project";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import { DurableProjectRepository, MemoryVersionedProjectStore } from "../persistence/durable-project-repository";
import { FflatePortableBackupDecoder } from "./fflate-portable-backup-decoder";
import { FflatePortableBackupEncoder } from "./fflate-portable-backup-encoder";

const now = "2026-10-24T12:00:00.000Z";
const binaryChecksum = { sha256Bytes: async (bytes: Uint8Array) => {
	const hash = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
	return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
} };
const checksum = { sha256: (text: string) => binaryChecksum.sha256Bytes(new TextEncoder().encode(text)) };

function oldProject(swingSide: "left" | "right" | undefined): Project {
	let index = 0;
	const ids = { next: () => `geometry-${++index}` };
	const room = configureRectangularRoom(createInitialProject({ projectId: "legacy-project", levelId: "legacy-level", name: "Старая дверь", createdAt: now }), {widthMm: "4000", depthMm: "3000", heightMm: "2600"}, ids, now);
	if (room.kind !== "accepted") throw new Error("Expected the original room");
	const wall = room.project.level.wallSegments[0];
	if (!wall) throw new Error("Expected the original wall");
	const door = addDoorOpeningToProject(room.project, { wallSegmentId: wall.wallSegmentId, offsetMm: 1000, widthMm: 900, heightMm: 2100, sillMm: 0 }, ids, now);
	if (door.kind !== "accepted") throw new Error("Expected the original opening");
	return { ...door.project, level: { ...door.project.level, openings: door.project.level.openings.map(opening => {
		if (opening.kind !== "Door" || opening.variant === "sliding") throw new Error("Expected the historical Door fixture");
		const { swingSide: _old, ...fields } = opening;
		return swingSide === undefined ? fields : {...fields, swingSide};
	}) } };
}

describe("legacy Door backup compatibility", () => {
	for (const swingSide of [undefined, "left", "right"] as const) {
		it(`preserves ${swingSide ?? "absent"} historical orientation through real ZIP verification and import without changing its source`, async () => {
			const project = oldProject(swingSide);
			const serializedProject = canonicalProjectSerializer.serialize(project);
			const candidate = {project, revision: { projectId: project.projectId, revisionId: "legacy-revision", schemaVersion: 1 as const, createdAt: now, serializedProject, checksum: await checksum.sha256(serializedProject) }};
			const exporter = new ExportPortableBackupUseCase({ checksum, binaryChecksum, encoder: new FflatePortableBackupEncoder(), serializer: canonicalProjectSerializer });
			const backup = await exporter.execute(candidate);
			expect(backup.kind).toBe("ready");
			if (backup.kind !== "ready") throw new Error("Expected a complete historical backup");
			const decoder = new FflatePortableBackupDecoder(binaryChecksum);
			const decoded = await decoder.decode(backup.bytes);
			expect(decoded.kind).toBe("accepted");
			if (decoded.kind !== "accepted") throw new Error("Expected exact verified ZIP members");
			expect(JSON.parse(new TextDecoder().decode(decoded.projectBytes)).level.openings).toEqual(project.level.openings);
			const repository = new DurableProjectRepository(new MemoryVersionedProjectStore(), checksum.sha256);
			await repository.publish(candidate);
			let sequence = 0;
			const importer = new ImportPortableBackupUseCase({ checksum, binaryChecksum, decoder, clock: {now: () => now}, ids: {next: () => `imported-${++sequence}`}, repository, serializer: canonicalProjectSerializer, smoke: {verify: async () => true} });
			const restored = await importer.execute(backup.bytes, () => undefined);
			expect(restored.kind).toBe("durable");
			if (restored.kind !== "durable") throw new Error("Expected a separate imported Project");
			expect(restored.projectId).not.toBe(project.projectId);
			const loaded = await repository.loadProject(restored.projectId);
			expect(loaded.kind).toBe("durable");
			if (loaded.kind !== "durable") throw new Error("Expected imported durability");
			expect(loaded.candidate.project.level.openings).toEqual(project.level.openings);
			const source = await repository.loadProject(project.projectId);
			expect(source).toEqual({kind: "durable", candidate});
			expect(canonicalProjectSerializer.serialize(project)).toBe(serializedProject);
		});
	}
});

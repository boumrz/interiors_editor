import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import type { Project } from "../domain/project";
import type {
	PublicationCandidate,
	PortableBackupArchiveWriterPort,
} from "./ports";
import { canonicalProjectSerializer } from "./create-project";
import { ExportRuntimePortableBackupUseCase } from "./export-runtime-portable-backup";

const instant = "2026-11-04T12:00:00.000Z";
const checksum = { sha256: async (value: string) => `checksum:${value}` };
function empty(): Project {
	return createInitialProject({
		createdAt: instant,
		projectId: "original",
		levelId: "level",
		name: "Exact source",
	});
}
async function candidate(project = empty()): Promise<PublicationCandidate> {
	const serializedProject = canonicalProjectSerializer.serialize(project);
	return {
		project,
		revision: {
			projectId: project.projectId,
			revisionId: "revision",
			schemaVersion: 1,
			createdAt: instant,
			serializedProject,
			checksum: await checksum.sha256(serializedProject),
		},
	};
}

describe("exact runtime V1 backup export", () => {
	it("checks initial cancellation and unsupported or mismatched identities before any asynchronous port", async () => {
		const source = await candidate(); const effects: string[] = [];
		const useCase = new ExportRuntimePortableBackupUseCase({ checksum: { sha256: async () => { effects.push("checksum"); return source.revision.checksum; } }, resources: { read: async () => { effects.push("read"); return undefined; } }, smoke: { verify: async () => { effects.push("smoke"); return true; } }, writer: { encode: async () => { effects.push("encode"); return { kind: "encoded", bytes: Uint8Array.of(80, 75), mimeType: "application/zip" }; } } });
		expect(await useCase.execute(source, { aborted: true })).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" }); expect(effects).toEqual([]);
		for (const field of ["project", "revision"] as const) {
			const invalid = { project: { ...source.project }, revision: { ...source.revision } };
			Object.defineProperty(invalid[field], "schemaVersion", { value: 2 });
			expect(await useCase.execute(invalid)).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" });
		}
		expect(await useCase.execute({ ...source, revision: { ...source.revision, projectId: "other" } })).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" }); expect(effects).toEqual([]);
	});
	it("does not format mismatched serialized bytes even when a checksum port returns the claimed checksum", async () => {
		const source = await candidate(); let encoded = 0;
		const useCase = new ExportRuntimePortableBackupUseCase({ checksum: { sha256: async () => source.revision.checksum }, resources: { read: async () => undefined }, smoke: { verify: async () => true }, writer: { encode: async () => { encoded++; return { kind: "encoded", bytes: Uint8Array.of(80, 75), mimeType: "application/zip" }; } } });
		expect(await useCase.execute({ ...source, revision: { ...source.revision, serializedProject: "{}" } })).toEqual({ kind: "rejected", reasonCode: "BACKUP_CHECKSUM_MISMATCH" }); expect(encoded).toBe(0);
	});
	for (const stage of ["checksum", "read", "smoke"] as const) it(`stops immediately after cancellation during ${stage}`, async () => {
		const source = await candidate({ ...empty(), assetDefinitionRefs: [{ assetDefinitionId: "asset", displayName: "Model", format: "glb", byteLength: 3, resourceHash: "a".repeat(64), widthMm: 100, heightMm: 100, depthMm: 100 }] });
		const signal = { aborted: false }; const effects: string[] = [];
		const useCase = new ExportRuntimePortableBackupUseCase({ checksum: { sha256: async () => { effects.push("checksum"); if (stage === "checksum") signal.aborted = true; return source.revision.checksum; } }, resources: { read: async () => { effects.push("read"); if (stage === "read") signal.aborted = true; return Uint8Array.of(1, 2, 3); } }, smoke: { verify: async () => { effects.push("smoke"); if (stage === "smoke") signal.aborted = true; return true; } }, writer: { encode: async () => { effects.push("encode"); return { kind: "encoded", mimeType: "application/zip", bytes: Uint8Array.of(80, 75) }; } } });
		expect(await useCase.execute(source, signal)).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" }); expect(effects).toEqual(["checksum", ...(stage !== "checksum" ? ["read"] : []), ...(stage === "smoke" ? ["smoke"] : [])]);
	});
	it("gives the formatter the exact object, not internal JSON, and leaves the durable source untouched", async () => {
		let next = 0;
		const configured = configureRectangularRoom(
			empty(),
			{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
			{ next: () => `id-${++next}` },
			instant,
		);
		if (configured.kind !== "accepted") throw new Error("Expected room");
		const project = {
			...configured.project,
			level: {
				...configured.project.level,
				vertices: configured.project.level.vertices.map((vertex, index) =>
					index === 0 ? { ...vertex, xMm: -0 } : vertex,
				),
				rooms: configured.project.level.rooms.map((room) => ({
					...room,
					name: undefined,
				})),
			},
		};
		const source = await candidate(project);
		let formatted = 0;
		const useCase = new ExportRuntimePortableBackupUseCase({
			checksum,
			resources: { read: async () => undefined },
			smoke: { verify: async () => true },
			writer: {
				encode: async (input) => {
					formatted++;
					expect(Object.is(input.project.level.vertices[0].xMm, -0)).toBe(true);
					expect(Object.hasOwn(input.project.level.rooms[0], "name")).toBe(
						true,
					);
					expect(input.createdAt).toBe(instant);
					return {
						kind: "encoded",
						mimeType: "application/zip",
						bytes: Uint8Array.of(80, 75, 1),
					};
				},
			},
		});
		expect(await useCase.execute(source)).toEqual({
			kind: "ready",
			filename: "Exact-source.interiors",
			mimeType: "application/zip",
			bytes: Uint8Array.of(80, 75, 1),
		});
		expect(formatted).toBe(1);
		expect(Object.is(source.project.level.vertices[0].xMm, -0)).toBe(true);
		expect(Object.hasOwn(source.project.level.rooms[0], "name")).toBe(true);
	});
	it("reads each exact original alias independently and lets the registered writer validate its bytes", async () => {
		const hashes = ["ab".repeat(32), "AB".repeat(32)];
		const bytes = Uint8Array.of(1, 2, 3);
		const reads: string[] = [];
		const source = await candidate({
			...empty(),
			assetDefinitionRefs: hashes.map((resourceHash, index) => ({
				assetDefinitionId: `asset-${index}`,
				displayName: "Model",
				format: "glb",
				byteLength: 3,
				resourceHash,
				widthMm: 100,
				heightMm: 100,
				depthMm: 100,
			})),
		});
		const writer: PortableBackupArchiveWriterPort = {
			encode: async (input) => {
				expect(
					input.resources.map((resource) => resource.resourceHash),
				).toEqual(hashes);
				expect(
					input.resources.every((resource) => resource.bytes !== bytes),
				).toBe(true);
				return { kind: "rejected", reasonCode: "BACKUP_CHECKSUM_MISMATCH" };
			},
		};
		const useCase = new ExportRuntimePortableBackupUseCase({
			checksum,
			writer,
			resources: {
				read: async (hash) => {
					reads.push(hash);
					return bytes;
				},
			},
			smoke: { verify: async () => true },
		});
		expect(await useCase.execute(source)).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_CHECKSUM_MISMATCH",
		});
		expect(reads).toEqual(hashes);
		expect(bytes).toEqual(Uint8Array.of(1, 2, 3));
	});
	it("keeps an invalid Plan's domain reason ahead of resource reads and formatting", async () => {
		const project = {
			...empty(),
			level: {
				...empty().level,
				vertices: [
					{ vertexId: "v1", xMm: 0, zMm: 0 },
					{ vertexId: "v2", xMm: 100, zMm: 50 },
				],
				wallSegments: [
					{
						wallSegmentId: "w1",
						startVertexId: "v1",
						endVertexId: "v2",
						thicknessMm: 100,
					},
				],
			},
		};
		const effects: string[] = [];
		const useCase = new ExportRuntimePortableBackupUseCase({
			checksum,
			resources: {
				read: async () => {
					effects.push("read");
					return undefined;
				},
			},
			smoke: {
				verify: async () => {
					effects.push("smoke");
					return false;
				},
			},
			writer: {
				encode: async () => {
					effects.push("encode");
					return {
						kind: "encoded",
						mimeType: "application/zip",
						bytes: Uint8Array.of(80, 75),
					};
				},
			},
		});
		expect(await useCase.execute(await candidate(project))).toEqual({
			kind: "rejected",
			reasonCode: "NON_ORTHOGONAL_WALL",
		});
		expect(effects).toEqual([]);
	});
	it("refuses missing, unreadable and wrong-length resource data before smoke or formatting", async () => {
		const source = await candidate({
			...empty(),
			assetDefinitionRefs: [
				{
					assetDefinitionId: "asset",
					displayName: "Model",
					format: "glb",
					byteLength: 3,
					resourceHash: "a".repeat(64),
					widthMm: 100,
					heightMm: 100,
					depthMm: 100,
				},
			],
		});
		for (const [read, reasonCode] of [
			[async () => undefined, "BACKUP_RESOURCE_MISSING"],
			[async () => Uint8Array.of(1, 2), "BACKUP_CHECKSUM_MISMATCH"],
			[
				async () => {
					throw new Error("Unavailable local bytes");
				},
				"PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
			],
		] as const) {
			const effects: string[] = [];
			const useCase = new ExportRuntimePortableBackupUseCase({
				checksum,
				resources: { read },
				smoke: {
					verify: async () => {
						effects.push("smoke");
						return true;
					},
				},
				writer: {
					encode: async () => {
						effects.push("encode");
						return {
							kind: "encoded",
							bytes: Uint8Array.of(80, 75),
							mimeType: "application/zip",
						};
					},
				},
			});
			expect(await useCase.execute(source)).toEqual({
				kind: "rejected",
				reasonCode,
			});
			expect(effects).toEqual([]);
		}
	});
	it("owns the source snapshot across checksum callbacks and discards an otherwise completed late-cancelled archive", async () => {
		const source = await candidate();
		const originalName = source.project.name;
		const signal = { aborted: false };
		let writes = 0;
		const useCase = new ExportRuntimePortableBackupUseCase({
			checksum: {
				sha256: async (serialized) => {
					Object.defineProperty(source.project, "name", {
						value: "Changed caller alias",
					});
					return checksum.sha256(serialized);
				},
			},
			resources: { read: async () => undefined },
			smoke: {
				verify: async (project) => {
					expect(project.name).toBe(originalName);
					return true;
				},
			},
			writer: {
				encode: async (input) => {
					expect(input.project.name).toBe(originalName);
					writes++;
					signal.aborted = true;
					return {
						kind: "encoded",
						mimeType: "application/zip",
						bytes: Uint8Array.of(80, 75),
					};
				},
			},
		});
		expect(await useCase.execute(source, signal)).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_CANCELLED",
		});
		expect(writes).toBe(1);
	});
	it("refuses cancellation, a changed internal checksum, missing bytes or a failed clean profile before emitting a backup", async () => {
		let encoded = 0;
		const writer: PortableBackupArchiveWriterPort = {
			encode: async () => {
				encoded++;
				return {
					kind: "encoded",
					mimeType: "application/zip",
					bytes: Uint8Array.of(80, 75),
				};
			},
		};
		const useCase = new ExportRuntimePortableBackupUseCase({
			checksum,
			writer,
			resources: { read: async () => undefined },
			smoke: { verify: async () => false },
		});
		const source = await candidate();
		expect(await useCase.execute(source, { aborted: true })).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_CANCELLED",
		});
		expect(
			await useCase.execute({
				...source,
				revision: { ...source.revision, checksum: "corrupt" },
			}),
		).toEqual({ kind: "rejected", reasonCode: "BACKUP_CHECKSUM_MISMATCH" });
		expect(await useCase.execute(source)).toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_RESOURCES_UNAVAILABLE",
		});
		expect(encoded).toBe(0);
	});
});

import { describe, expect, it } from "@rstest/core";
import { canonicalProjectSerializer } from "../../application/create-project";
import type {
	BinaryChecksumPort,
	ChecksumPort,
	PublicationCandidate,
	WriterTakeoverRequirementStorePort,
} from "../../application/ports";
import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import type { SessionHistoryRootSnapshot } from "../../application/session-retention-project-repository";
import { createInitialProject } from "../../domain/initial-project";
import type { CustomGlbAssetDefinition } from "../../domain/project";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import type { ScopedProjectStore } from "./scoped-project-protocol";
import { ScopedProjectRepository } from "./scoped-project-repository";
import { decideTelegramWriterLease } from "./telegram-writer-lease";

// Public pre-admission contract only. The spy never supplies Access, a transaction,
// a lease, or a stored result. Native publication/repair proofs remain mandatory.
const instant = "2026-11-04T12:00:00.000Z";
const binaryChecksum: BinaryChecksumPort = {
	async sha256Bytes(bytes) {
		const digest = new Uint8Array(
			await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
		);
		return Array.from(digest, (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
	},
};
const checksum: ChecksumPort = {
	sha256: (text) => binaryChecksum.sha256Bytes(new TextEncoder().encode(text)),
};
const resourceBytes = () => new Uint8Array([81, 82, 83]);
async function fixture(withResource = false): Promise<PublicationCandidate> {
	let next = 0;
	const configured = configureRectangularRoom(
		createInitialProject({
			projectId: "prefix-project",
			levelId: "level",
			name: "Public preflight",
			createdAt: instant,
		}),
		{ widthMm: "5000", depthMm: "4000", heightMm: "2600" },
		{ next: () => `fixture-${next++}` },
		instant,
	);
	if (configured.kind !== "accepted")
		throw new Error("Domain fixture was not accepted");
	const bytes = resourceBytes(),
		asset: CustomGlbAssetDefinition = {
			assetDefinitionId: "custom",
			displayName: "Local model",
			format: "glb",
			resourceHash: await binaryChecksum.sha256Bytes(bytes),
			byteLength: bytes.byteLength,
			widthMm: 100,
			depthMm: 100,
			heightMm: 100,
		};
	const project = withResource
		? { ...configured.project, assetDefinitionRefs: [asset] }
		: configured.project;
	expect(validateRuntimeV1Project(project).kind).toBe("accepted");
	const serializedProject = canonicalProjectSerializer.serialize(project);
	return {
		project,
		revision: {
			projectId: project.projectId,
			revisionId: "prefix-r1",
			schemaVersion: 1,
			createdAt: instant,
			serializedProject,
			checksum: await checksum.sha256(serializedProject),
		},
	};
}
function subject(roots?: () => SessionHistoryRootSnapshot) {
	const boundary = { calls: 0 };
	const storage: ScopedProjectStore = {
		async run() {
			boundary.calls++;
			throw new Error("Owned boundary deliberately unavailable");
		},
	};
	const required = new Set<string>();
	const takeoverRequirements: WriterTakeoverRequirementStorePort = {
		requiresExplicitTakeover: (projectId) => required.has(projectId),
		requireExplicitTakeover: (projectId) => {
			required.add(projectId);
		},
		clearExplicitTakeoverRequirement: (projectId) => {
			required.delete(projectId);
		},
	};
	const repository = new ScopedProjectRepository(
		storage,
		{
			ownerId: "prefix-owner",
			nowEpochMs: () => 1000,
			takeoverRequirements,
			checksum,
			binaryChecksum,
			sessionRoots: roots,
		},
		{
			operationIdPrefix: (scope, kind) => `tma-v1:${scope}:${kind}:`,
			decideWriterLease: decideTelegramWriterLease,
		},
	);
	return { repository, boundary };
}
async function resign(source: PublicationCandidate) {
	const serializedProject = canonicalProjectSerializer.serialize(
		source.project,
	);
	Reflect.set(source.revision, "serializedProject", serializedProject);
	Reflect.set(
		source.revision,
		"checksum",
		await checksum.sha256(serializedProject),
	);
}

describe("common public input denial before admitting an owned store operation", () => {
	it("allows an independent valid domain snapshot to reach the throwing boundary once", async () => {
		const source = await fixture(),
			before = structuredClone(source),
			{ repository, boundary } = subject();
		expect(await repository.publish(source)).toEqual({
			kind: "persist-failed",
			reasonCode: "PERSISTENCE_WRITE_FAILED",
		});
		expect(boundary.calls).toBe(1);
		expect(source).toStrictEqual(before);
	});
	for (const mode of [
		"checksum",
		"project-identity",
		"revision-identity",
		"schema",
		"fractional-geometry",
		"negative-room-height",
		"noncanonical-source",
		"different-project-source",
	] as const) {
		it(`refuses ${mode} publication with exact input preservation and no store admission`, async () => {
			const source = await fixture();
			if (mode === "checksum")
				Reflect.set(source.revision, "checksum", "f".repeat(64));
			else if (mode === "project-identity")
				Reflect.set(source.revision, "projectId", "another-project");
			else if (mode === "revision-identity")
				Reflect.set(source.revision, "revisionId", "");
			else if (mode === "schema")
				Reflect.set(source.revision, "schemaVersion", 2);
			else if (mode === "fractional-geometry") {
				Reflect.set(source.project.level.vertices[0], "xMm", 0.5);
				await resign(source);
			} else if (mode === "negative-room-height") {
				Reflect.set(source.project.level.rooms[0], "heightMm", -1);
				await resign(source);
			} else if (mode === "noncanonical-source") {
				Reflect.set(
					source.revision,
					"serializedProject",
					source.revision.serializedProject + " ",
				);
				Reflect.set(
					source.revision,
					"checksum",
					await checksum.sha256(source.revision.serializedProject),
				);
			} else
				Reflect.set(
					source.project,
					"name",
					"Different but independently valid",
				);
			const before = structuredClone(source),
				{ repository, boundary } = subject();
			expect(await repository.publish(source)).toEqual({
				kind: "persist-failed",
				reasonCode: "PERSISTENCE_WRITE_FAILED",
			});
			expect(boundary.calls).toBe(0);
			expect(source).toStrictEqual(before);
		});
	}
	it("allows exact library metadata and actual SHA bytes to reach the owned boundary once", async () => {
		const source = await fixture(true),
			{ repository, boundary } = subject();
		await expect(
			repository.library.register(source.project.assetDefinitionRefs[0], {
				resourceHash: source.project.assetDefinitionRefs[0].resourceHash,
				bytes: resourceBytes(),
			}),
		).rejects.toBeDefined();
		expect(boundary.calls).toBe(1);
	});
	for (const mode of [
		"dimension",
		"format",
		"asset-hash",
		"declared-size",
		"wrong-exact-bytes",
	] as const) {
		it(`refuses incoming library ${mode} before storage and preserves the caller`, async () => {
			const source = await fixture(true),
				asset = structuredClone(source.project.assetDefinitionRefs[0]),
				resource = { resourceHash: asset.resourceHash, bytes: resourceBytes() };
			if (mode === "dimension") Reflect.set(asset, "widthMm", 0.5);
			else if (mode === "format") Reflect.set(asset, "format", "fbx");
			else if (mode === "asset-hash")
				Reflect.set(asset, "resourceHash", "f".repeat(64));
			else if (mode === "declared-size")
				Reflect.set(asset, "byteLength", asset.byteLength + 1);
			else
				resource.bytes = Uint8Array.from(
					resource.bytes,
					(value) => value ^ 0x55,
				);
			const before = structuredClone({ asset, resource }),
				{ repository, boundary } = subject();
			await expect(
				repository.library.register(asset, resource),
			).rejects.toBeDefined();
			expect(boundary.calls).toBe(0);
			expect({ asset, resource }).toStrictEqual(before);
		});
	}
	it("allows independently valid current/history repair bytes to reach the boundary once", async () => {
		const source = await fixture(true),
			{ repository, boundary } = subject(() => ({
				current: source,
				undo: [],
				redo: [],
			}));
		const repair = repository.resources.writeReplacingBatch;
		if (!repair) throw new Error("Missing public exact repair port");
		await expect(
			repair([
				{
					resourceHash: source.project.assetDefinitionRefs[0].resourceHash,
					bytes: resourceBytes(),
				},
			]),
		).rejects.toBeDefined();
		expect(boundary.calls).toBe(1);
	});
	for (const mode of [
		"missing-roots",
		"empty-input",
		"foreign-history",
		"duplicate-input",
		"unreferenced-input",
		"wrong-exact-bytes",
	] as const) {
		it(`refuses repair ${mode} without touching the store or input bytes`, async () => {
			const source = await fixture(true),
				resource = {
					resourceHash: source.project.assetDefinitionRefs[0].resourceHash,
					bytes: resourceBytes(),
				};
			if (mode === "unreferenced-input") {
				resource.bytes = new Uint8Array([91, 92, 93]);
				resource.resourceHash = await binaryChecksum.sha256Bytes(
					resource.bytes,
				);
			}
			if (mode === "wrong-exact-bytes")
				resource.bytes = Uint8Array.from(
					resource.bytes,
					(value) => value ^ 0x55,
				);
			const input =
					mode === "empty-input"
						? []
						: mode === "duplicate-input"
							? [resource, structuredClone(resource)]
							: [resource],
				before = structuredClone(input);
			const foreign = structuredClone(source);
			Reflect.set(foreign.project, "projectId", "another-project");
			Reflect.set(foreign.revision, "projectId", "another-project");
			Reflect.set(foreign.revision, "revisionId", "another-r1");
			await resign(foreign);
			const { repository, boundary } = subject(
				mode === "missing-roots"
					? undefined
					: () => ({
							current: source,
							undo: mode === "foreign-history" ? [foreign] : [],
							redo: [],
						}),
			);
			const repair = repository.resources.writeReplacingBatch;
			if (!repair) throw new Error("Missing public exact repair port");
			await expect(repair(input)).rejects.toBeDefined();
			expect(boundary.calls).toBe(0);
			expect(input).toStrictEqual(before);
		});
	}
	it("admits a valid resource-bearing pin request to the unavailable store once", async () => {
		const source = await fixture(true),
			{ repository, boundary } = subject();
		await expect(
			repository.pinStaging.begin(
				[source.project.assetDefinitionRefs[0].resourceHash],
				{ candidate: source },
			),
		).rejects.toBeDefined();
		expect(boundary.calls).toBe(1);
	});
	for (const mode of [
		"missing-context",
		"empty-hashes",
		"duplicate-hashes",
		"unreferenced-hash",
		"bad-candidate-checksum",
	] as const) {
		it(`refuses pin ${mode} before admitting any owned-store operation`, async () => {
			const source = await fixture(true),
				hash = source.project.assetDefinitionRefs[0].resourceHash;
			if (mode === "bad-candidate-checksum")
				Reflect.set(source.revision, "checksum", "f".repeat(64));
			const hashes =
					mode === "empty-hashes"
						? []
						: mode === "duplicate-hashes"
							? [hash, hash]
							: mode === "unreferenced-hash"
								? ["f".repeat(64)]
								: [hash],
				before = structuredClone({ source, hashes });
			const { repository, boundary } = subject();
			await expect(
				repository.pinStaging.begin(
					hashes,
					mode === "missing-context" ? undefined : { candidate: source },
				),
			).rejects.toBeDefined();
			expect(boundary.calls).toBe(0);
			expect({ source, hashes }).toStrictEqual(before);
		});
	}
	it("lets independently hashed nonempty bytes reach the pin-store boundary once", async () => {
		const bytes = resourceBytes(),
			{ repository, boundary } = subject(),
			resource = {
				bytes,
				resourceHash: await binaryChecksum.sha256Bytes(bytes),
			};
		const write = repository.resources.writeIfAbsentPinned;
		if (!write) throw new Error("Missing public pinned writer");
		await expect(
			write(resource, "tma-v1:tg-prod-777-42:lease:1"),
		).rejects.toBeDefined();
		expect(boundary.calls).toBe(1);
	});
	it("refuses same-length wrong bytes before accessing even a supplied lease address", async () => {
		const bytes = resourceBytes(),
			resourceHash = await binaryChecksum.sha256Bytes(bytes),
			resource = {
				resourceHash,
				bytes: Uint8Array.from(bytes, (value) => value ^ 0x55),
			},
			before = structuredClone(resource),
			{ repository, boundary } = subject();
		const write = repository.resources.writeIfAbsentPinned;
		if (!write) throw new Error("Missing public pinned writer");
		await expect(
			write(resource, "tma-v1:tg-prod-777-42:lease:1"),
		).rejects.toBeDefined();
		expect(boundary.calls).toBe(0);
		expect(resource).toStrictEqual(before);
	});
});

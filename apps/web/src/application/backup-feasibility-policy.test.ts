import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import type { CustomGlbAssetDefinition } from "../domain/project";
import { canonicalProjectSerializer } from "./create-project";
import type { PublicationCandidate } from "./ports";
import { copyProject } from "../domain/copy-project";
import {
	assessBackupFeasibility,
	assessBackupEnvelopeFeasibility,
} from "./backup-feasibility-policy";

function definition(
	resourceHash: string,
	byteLength: number,
): CustomGlbAssetDefinition {
	return {
		assetDefinitionId: `definition-${resourceHash}`,
		byteLength,
		depthMm: 100,
		displayName: "Model",
		format: "glb",
		heightMm: 100,
		resourceHash,
		widthMm: 100,
	};
}

function candidate(
	definitions: readonly CustomGlbAssetDefinition[],
): PublicationCandidate {
	const initial = createInitialProject({
		createdAt: "2026-11-04T12:00:00.000Z",
		levelId: "level",
		name: "Exact resources",
		projectId: "project",
	});
	const project = { ...initial, assetDefinitionRefs: definitions };
	return {
		project,
		revision: {
			checksum: "opaque-legacy-Revision-checksum",
			createdAt: project.updatedAt,
			projectId: project.projectId,
			revisionId: "revision",
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(project),
		},
	};
}

async function sha256(bytes: Uint8Array): Promise<string> {
	return [
		...new Uint8Array(
			await (
				globalThis as typeof globalThis & {
					readonly crypto: {
						readonly subtle: {
							digest(
								algorithm: string,
								data: ArrayBuffer,
							): Promise<ArrayBuffer>;
						};
					};
				}
			).crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
		),
	]
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}

function mixedCase(hash: string): string {
	return [...hash]
		.map((value, index) => (index % 2 ? value.toUpperCase() : value))
		.join("");
}

const rejected = {
	kind: "rejected",
	reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
};

describe("exact original-key resource feasibility", () => {
	it("uses the V1 metadata reserve and refuses differing alias bytes even when an injected digest agrees", async () => {
		const first = "a".repeat(64),
			second = "A".repeat(64);
		const source = candidate([definition(first, 3), definition(second, 3)]);
		expect(
			await assessBackupEnvelopeFeasibility(source, 512, {
				resources: {
					read: async (key) =>
						key === first ? Uint8Array.of(1, 2, 3) : Uint8Array.of(1, 2, 4),
				},
				binaryChecksum: { sha256Bytes: async () => first },
			}),
		).toEqual(rejected);
		// A narrow independent container-boundary vector; current whole-Project
		// policy is enforced by the registered adapter before this shared arithmetic.
		const definitions = [
			definition(first, 50 * 1024 * 1024),
			definition(second, 50 * 1024 * 1024),
			definition("b".repeat(64), 50 * 1024 * 1024),
			definition("c".repeat(64), 30 * 1024 * 1024),
		];
		const maximum =
			190 * 1024 * 1024 - 180 * 1024 * 1024 - 4096 - definitions.length * 1024;
		expect(
			await assessBackupEnvelopeFeasibility(candidate(definitions), maximum),
		).toEqual({ kind: "accepted" });
		expect(
			await assessBackupEnvelopeFeasibility(
				candidate(definitions),
				maximum + 1,
			),
		).toEqual(rejected);
	});
	it("keeps the browser AST boundary while the registered route measures its validated exact wire member", async () => {
		const source = candidate([]);
		const project = {
			...source.project,
			level: { ...source.project.level, levelId: "level-\ud800" },
		};
		const exact = {
			project,
			revision: {
				...source.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		expect(await assessBackupFeasibility(exact)).toEqual(rejected);
		expect(await assessBackupEnvelopeFeasibility(exact, 512)).toEqual({
			kind: "accepted",
		});
		for (const byteLength of [
			-1,
			1.5,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			10 * 1024 * 1024 + 1,
		])
			expect(await assessBackupEnvelopeFeasibility(exact, byteLength)).toEqual(
				rejected,
			);
		expect(
			await assessBackupEnvelopeFeasibility(exact, 10 * 1024 * 1024),
		).toEqual({ kind: "accepted" });
	});
	it("independently verifies lower, upper and mixed resource keys without interpreting Revision checksums", async () => {
		const bytes = Uint8Array.of(1, 2, 3, 255);
		const lower = await sha256(bytes);
		const aliases = [lower, lower.toUpperCase(), mixedCase(lower)];
		expect(new Set(aliases).size).toBe(3);
		const source = candidate(
			aliases.map((hash) => definition(hash, bytes.byteLength)),
		);
		const before = {
			project: copyProject(source.project),
			revision: { ...source.revision },
		};
		const stored = new Map(aliases.map((hash) => [hash, bytes.slice()]));
		const reads: string[] = [];
		let hashes = 0;
		expect(
			await assessBackupFeasibility(source, {
				resources: {
					read: async (hash) => {
						reads.push(hash);
						return stored.get(hash);
					},
				},
				binaryChecksum: {
					sha256Bytes: async (value) => {
						hashes++;
						return (await sha256(value)).toUpperCase();
					},
				},
			}),
		).toEqual({ kind: "accepted" });
		expect(reads).toEqual(aliases);
		expect(hashes).toBe(3);
		expect(source).toEqual(before);
		expect(source.revision.checksum).toBe("opaque-legacy-Revision-checksum");
	});

	it("refuses a missing, wrong-length or corrupt alias even when another case key has healthy exact bytes", async () => {
		const bytes = Uint8Array.of(1, 2, 3, 255);
		const lower = await sha256(bytes),
			upper = lower.toUpperCase();
		const source = candidate([definition(lower, 4), definition(upper, 4)]);
		for (const bad of [
			undefined,
			bytes.subarray(0, 3),
			Uint8Array.of(1, 2, 3, 254),
		]) {
			const reads: string[] = [];
			expect(
				await assessBackupFeasibility(source, {
					resources: {
						read: async (hash) => {
							reads.push(hash);
							return hash === lower ? bytes : bad;
						},
					},
					binaryChecksum: { sha256Bytes: sha256 },
				}),
			).toEqual(rejected);
			expect(reads).toEqual([lower, upper]);
		}
	});

	it("rejects malformed resource names before storage access while preserving metadata-only feasibility", async () => {
		for (const hash of [
			"not-a-digest",
			"g".repeat(64),
			`${"a".repeat(64)}\n`,
		]) {
			const source = candidate([definition(hash, 1)]);
			let reads = 0,
				hashes = 0;
			expect(
				await assessBackupFeasibility(source, {
					resources: {
						read: async () => {
							reads++;
							return Uint8Array.of(0);
						},
					},
					binaryChecksum: {
						sha256Bytes: async () => {
							hashes++;
							return hash;
						},
					},
				}),
			).toEqual(rejected);
			expect(reads).toBe(0);
			expect(hashes).toBe(0);
			expect(await assessBackupFeasibility(source)).toEqual({
				kind: "accepted",
			});
		}
	});

	it("rejects malformed computed digests, changed bits and failing resource ports", async () => {
		const bytes = Uint8Array.of(1, 2, 3, 255);
		const hash = await sha256(bytes);
		const source = candidate([definition(hash, 4)]);
		for (const digest of [
			hash.slice(1),
			`${hash}0`,
			`g${hash.slice(1)}`,
			`${hash.slice(0, -1)}${hash.endsWith("0") ? "1" : "0"}`,
		]) {
			expect(
				await assessBackupFeasibility(source, {
					resources: { read: async () => bytes },
					binaryChecksum: { sha256Bytes: async () => digest },
				}),
			).toEqual(rejected);
		}
		for (const failedPort of ["read", "hash"]) {
			expect(
				await assessBackupFeasibility(source, {
					resources: {
						read: async () => {
							if (failedPort === "read") throw new Error("read failed");
							return bytes;
						},
					},
					binaryChecksum: {
						sha256Bytes: async () => {
							throw new Error("hash failed");
						},
					},
				}),
			).toEqual(rejected);
		}
	});

	it("counts original case keys toward the aggregate budget before any archive alias dedup or resource read", async () => {
		const aliases = [
			"a".repeat(64),
			"A".repeat(64),
			"aA".repeat(32),
			"b".repeat(64),
		];
		const sizes = [50, 50, 50, 30];
		const exact = aliases.map((hash, index) =>
			definition(hash, sizes[index] * 1024 * 1024),
		);
		expect(await assessBackupFeasibility(candidate(exact))).toEqual({
			kind: "accepted",
		});
		let reads = 0;
		const tooLarge = exact.map((value, index) =>
			index === 3 ? { ...value, byteLength: value.byteLength + 1 } : value,
		);
		expect(
			await assessBackupFeasibility(candidate(tooLarge), {
				resources: {
					read: async () => {
						reads++;
						return undefined;
					},
				},
				binaryChecksum: { sha256Bytes: async () => "unused" },
			}),
		).toEqual(rejected);
		expect(reads).toBe(0);
	});
});

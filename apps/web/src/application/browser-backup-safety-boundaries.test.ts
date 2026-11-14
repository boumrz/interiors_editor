import { expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import type { Project } from "../domain/project";
import {
	assessBrowserBackupRepresentability,
	verifyBrowserBackupCandidate,
} from "./browser-backup-representability";
import { canonicalProjectSerializer } from "./create-project";
import type {
	BinaryChecksumPort,
	CustomAssetResource,
	PublicationCandidate,
} from "./ports";

const instant = "2026-11-04T12:00:00.000Z";
const cryptoModule = "node:crypto";
const bufferModule = "node:buffer";
async function utf8(value: string): Promise<Uint8Array> {
	const native: {
		Buffer: { from(value: string, encoding: "utf8"): Uint8Array };
	} = await import(bufferModule);
	return new Uint8Array(native.Buffer.from(value, "utf8"));
}
const checksum: BinaryChecksumPort = {
	async sha256Bytes(bytes) {
		const native: {
			createHash(type: string): {
				update(bytes: Uint8Array): { digest(encoding: "hex"): string };
			};
		} = await import(cryptoModule);
		return native.createHash("sha256").update(bytes).digest("hex");
	},
};
const rejected = {
	kind: "rejected",
	reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
};
function source(): Project {
	return createInitialProject({
		createdAt: instant,
		levelId: "level",
		name: "Original",
		projectId: "source",
	});
}
async function candidate(project: Project): Promise<PublicationCandidate> {
	const owned = {
		...project,
		projectId: "12345678-1234-4234-9234-123456789abc",
		updatedAt: "+010000-01-01T00:00:00.000Z",
	};
	const serializedProject = canonicalProjectSerializer.serialize(owned);
	return {
		project: owned,
		revision: {
			projectId: owned.projectId,
			revisionId: "abcdef01-1234-4234-9234-123456789abc",
			schemaVersion: 1,
			createdAt: owned.updatedAt,
			serializedProject,
			checksum: await checksum.sha256Bytes(await utf8(serializedProject)),
		},
	};
}
function withResources(
	project: Project,
	resources: readonly CustomAssetResource[],
): Project {
	return {
		...project,
		assetDefinitionRefs: resources.map(({ resourceHash, bytes }, index) => ({
			assetDefinitionId: `model-${index}`,
			displayName: "Model",
			format: "glb",
			resourceHash,
			byteLength: bytes.byteLength,
			widthMm: 100,
			depthMm: 100,
			heightMm: 100,
		})),
	};
}

it("rejects changed source content even when every generated candidate byte and digest agrees and byte length is unchanged", async () => {
	const original = source(),
		represented = await assessBrowserBackupRepresentability(
			original,
			[],
			checksum,
		);
	if (represented.kind !== "representable")
		throw new Error("Source prerequisite failed");
	const valid = await candidate(original);
	expect(
		await verifyBrowserBackupCandidate(valid, represented.proof, [], checksum),
	).toEqual({ kind: "accepted" });
	const changed = await candidate({ ...original, name: "Altered!" });
	expect((await utf8(changed.revision.serializedProject)).byteLength).toBe(
		(await utf8(valid.revision.serializedProject)).byteLength,
	);
	expect(
		await verifyBrowserBackupCandidate(
			changed,
			represented.proof,
			[],
			checksum,
		),
	).toEqual(rejected);
	expect(original.name).toBe("Original");
});

it("requires exact resource bytes independently of a checksum port reporting a collision", async () => {
	const bytes = Uint8Array.of(1, 2, 3),
		resourceHash = await checksum.sha256Bytes(bytes);
	const resources = [{ resourceHash, bytes }],
		project = withResources(source(), resources);
	const represented = await assessBrowserBackupRepresentability(
		project,
		resources,
		checksum,
	);
	if (represented.kind !== "representable")
		throw new Error("Resource prerequisite failed");
	const actual = await candidate(project);
	let resourceDigests = 0;
	const colliding: BinaryChecksumPort = {
		sha256Bytes: async (value) => {
			if (value.byteLength === 3) {
				resourceDigests++;
				return resourceHash;
			}
			return checksum.sha256Bytes(value);
		},
	};
	expect(
		await verifyBrowserBackupCandidate(
			actual,
			represented.proof,
			resources,
			colliding,
		),
	).toEqual({ kind: "accepted" });
	resourceDigests = 0;
	const altered = [{ resourceHash, bytes: Uint8Array.of(1, 2, 4) }];
	expect(
		await verifyBrowserBackupCandidate(
			actual,
			represented.proof,
			altered,
			colliding,
		),
	).toEqual(rejected);
	expect(resourceDigests).toBe(0);
	expect(resources[0].bytes).toStrictEqual(Uint8Array.of(1, 2, 3));
});

it("does no source resource snapshot work after cancellation was already requested", async () => {
	let sourceReads = 0,
		digests = 0;
	const resource = {
		get resourceHash() {
			sourceReads++;
			return "a".repeat(64);
		},
		get bytes() {
			sourceReads++;
			return Uint8Array.of(1);
		},
	};
	expect(
		await assessBrowserBackupRepresentability(
			source(),
			[resource],
			{
				sha256Bytes: async () => {
					digests++;
					return "a".repeat(64);
				},
			},
			{ aborted: true },
		),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	expect(sourceReads).toBe(0);
	expect(digests).toBe(0);
});

it("does not hash a generated candidate after cancellation was already requested", async () => {
	const original = source(),
		represented = await assessBrowserBackupRepresentability(
			original,
			[],
			checksum,
		);
	if (represented.kind !== "representable")
		throw new Error("Source prerequisite failed");
	const actual = await candidate(original);
	let digests = 0;
	expect(
		await verifyBrowserBackupCandidate(
			actual,
			represented.proof,
			[],
			{
				sha256Bytes: async (value) => {
					digests++;
					return checksum.sha256Bytes(value);
				},
			},
			{ aborted: true },
		),
	).toEqual({ kind: "rejected", reasonCode: "BACKUP_CANCELLED" });
	expect(digests).toBe(0);
});

// Deliberately controlled digest port isolates envelope arithmetic from cryptography.
// Overlapping views share a bounded backing buffer; each first byte addresses its fixture hash.
function budgetResources(sizes: readonly number[]) {
	const backing = new Uint8Array(Math.max(...sizes) + sizes.length);
	const resources = sizes.map((size, index) => ({
		resourceHash: (index + 1).toString(16).padStart(64, "0"),
		bytes: backing.subarray(index, index + size),
	}));
	resources.forEach(({ bytes }, index) => {
		bytes[0] = index + 1;
	});
	let calls = 0;
	return {
		resources,
		calls: () => calls,
		checksum: {
			sha256Bytes: async (bytes: Uint8Array) => {
				calls++;
				return bytes[0].toString(16).padStart(64, "0");
			},
		},
	};
}
it("admits the exact 50 MiB resource boundary and rejects the next byte before digest work", async () => {
	const mib = 1024 * 1024;
	for (const size of [50 * mib, 50 * mib + 1]) {
		const f = budgetResources([size]),
			project = withResources(source(), f.resources);
		const result = await assessBrowserBackupRepresentability(
			project,
			f.resources,
			f.checksum,
		);
		expect(result.kind).toBe(size === 50 * mib ? "representable" : "rejected");
		expect(f.calls()).toBe(size === 50 * mib ? 1 : 0);
	}
});
it("admits the exact 180 MiB total and rejects the next byte before any resource digest", async () => {
	const mib = 1024 * 1024;
	for (const extra of [0, 1]) {
		const f = budgetResources([50 * mib, 50 * mib, 50 * mib, 30 * mib + extra]),
			project = withResources(source(), f.resources);
		const result = await assessBrowserBackupRepresentability(
			project,
			f.resources,
			f.checksum,
		);
		expect(result.kind).toBe(extra === 0 ? "representable" : "rejected");
		expect(f.calls()).toBe(extra === 0 ? 4 : 0);
	}
});

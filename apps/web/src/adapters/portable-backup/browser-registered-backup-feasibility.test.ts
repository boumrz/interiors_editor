import { expect, it } from "@rstest/core";
import { assessBackupFeasibility } from "../../application/backup-feasibility-policy";
import { createBrowserRegisteredBackupFeasibility } from "../../application/browser-registered-backup-feasibility";
import { canonicalProjectSerializer } from "../../application/create-project";
import type { PublicationCandidate } from "../../application/ports";
import { createInitialProject } from "../../domain/initial-project";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import { preflightStaticGlbImport } from "../../domain/static-glb-import";

const instant = "2026-11-05T00:00:00.000Z";
function candidate(): PublicationCandidate {
	let n = 0;
	const configured = configureRectangularRoom(
		createInitialProject({
			projectId: "11111111-1111-4111-8111-111111111111",
			levelId: "level",
			name: "Valid",
			createdAt: instant,
		}),
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		{ next: () => `geometry-${++n}` },
		instant,
	);
	if (configured.kind !== "accepted") throw new Error("Bad fixture");
	const project = configured.project;
	return {
		project,
		revision: {
			projectId: project.projectId,
			revisionId: "22222222-2222-4222-8222-222222222222",
			createdAt: instant,
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(project),
			checksum: "not-used-by-size-policy",
		},
	};
}
const actualBinaryChecksum = {
	sha256Bytes: async (bytes: Uint8Array) =>
		[
			...new Uint8Array(
				await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
			),
		]
			.map((value) => value.toString(16).padStart(2, "0"))
			.join(""),
};
async function resourceCandidate() {
	const text = new TextEncoder().encode(
		JSON.stringify({
			asset: { version: "2.0" },
			buffers: [{ byteLength: 0 }],
			scenes: [{ nodes: [] }],
		}),
	);
	const size = Math.ceil(text.length / 4) * 4,
		bytes = new Uint8Array(20 + size),
		view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.length, true);
	view.setUint32(12, size, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.fill(0x20, 20);
	bytes.set(text, 20);
	expect(preflightStaticGlbImport(bytes).kind).toBe("accepted");
	const resourceHash = await actualBinaryChecksum.sha256Bytes(bytes);
	const base = candidate();
	const project = {
		...base.project,
		assetDefinitionRefs: [
			{
				assetDefinitionId: "owned-resource",
				displayName: "Local",
				resourceHash,
				byteLength: bytes.length,
				format: "glb" as const,
				widthMm: 500,
				depthMm: 500,
				heightMm: 800,
			},
		],
	};
	return {
		bytes,
		resourceHash,
		candidate: {
			project,
			revision: {
				...base.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		},
	};
}
it("captures the exact already-pinned resource once through existing feasibility and proves its real digest", async () => {
	const f = await resourceCandidate(),
		reads: string[] = [];
	const policy = createBrowserRegisteredBackupFeasibility(actualBinaryChecksum);
	expect(
		await policy.assess(f.candidate, {
			binaryChecksum: actualBinaryChecksum,
			resources: {
				read: async (key) => {
					reads.push(key);
					return f.bytes.slice();
				},
			},
		}),
	).toEqual({ kind: "accepted" });
	expect(reads).toEqual([f.resourceHash]);
});
it("keeps missing, corrupt, wrong-length and absent-resource-port candidates outside Durable", async () => {
	const f = await resourceCandidate(),
		policy = createBrowserRegisteredBackupFeasibility(actualBinaryChecksum);
	expect(await policy.assess(f.candidate)).toEqual({
		kind: "rejected",
		reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
	});
	const changed = f.bytes.slice();
	changed[changed.length - 1] ^= 1;
	for (const bytes of [undefined, f.bytes.slice(1), changed])
		expect(
			await policy.assess(f.candidate, {
				binaryChecksum: actualBinaryChecksum,
				resources: { read: async () => bytes },
			}),
		).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
});
it("keeps raw uppercase resource addresses out of this browser-only profile while the existing policy accepts exact digest bits", async () => {
	const f = await resourceCandidate();
	const project = {
		...f.candidate.project,
		assetDefinitionRefs: f.candidate.project.assetDefinitionRefs.map((ref) => ({
			...ref,
			resourceHash: ref.resourceHash.toUpperCase(),
		})),
	};
	const value = {
		project,
		revision: {
			...f.candidate.revision,
			serializedProject: canonicalProjectSerializer.serialize(project),
		},
	};
	const reads: string[] = [],
		ports = {
			binaryChecksum: actualBinaryChecksum,
			resources: {
				read: async (key: string) => {
					reads.push(key);
					return f.bytes;
				},
			},
		};
	expect(await assessBackupFeasibility(value, ports)).toEqual({
		kind: "accepted",
	});
	expect(
		await createBrowserRegisteredBackupFeasibility(actualBinaryChecksum).assess(
			value,
			ports,
		),
	).toEqual({
		kind: "rejected",
		reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
	});
	expect(reads).toEqual([
		f.resourceHash.toUpperCase(),
		f.resourceHash.toUpperCase(),
	]);
});
it("preserves old malformed-member refusal before any resource IO or additional representation assessment", async () => {
	const f = await resourceCandidate();
	const reads: string[] = [];
	const policy = createBrowserRegisteredBackupFeasibility({
		sha256Bytes: async () => {
			throw new Error("Additional representation hashing must not run");
		},
	});
	expect(
		await policy.assess(
			{
				...f.candidate,
				revision: { ...f.candidate.revision, serializedProject: "{" },
			},
			{
				binaryChecksum: actualBinaryChecksum,
				resources: {
					read: async (key) => {
						reads.push(key);
						return f.bytes;
					},
				},
			},
		),
	).toEqual({
		kind: "rejected",
		reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
	});
	expect(reads).toEqual([]);
});
it("maps a later exact-resource representation hashing failure to a policy refusal without changing old acceptance", async () => {
	const f = await resourceCandidate(),
		ports = {
			binaryChecksum: actualBinaryChecksum,
			resources: { read: async () => f.bytes },
		};
	expect(await assessBackupFeasibility(f.candidate, ports)).toEqual({
		kind: "accepted",
	});
	expect(
		await createBrowserRegisteredBackupFeasibility({
			sha256Bytes: async () => {
				throw new Error("Additional hash unavailable");
			},
		}).assess(f.candidate, ports),
	).toEqual({
		kind: "rejected",
		reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
	});
});

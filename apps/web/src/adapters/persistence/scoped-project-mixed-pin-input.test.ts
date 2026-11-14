import { describe, expect, it } from "@rstest/core";
import { canonicalProjectSerializer } from "../../application/create-project";
import type {
	BinaryChecksumPort,
	ChecksumPort,
	PublicationCandidate,
} from "../../application/ports";
import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import { createInitialProject } from "../../domain/initial-project";
import type { CustomGlbAssetDefinition } from "../../domain/project";
import type { ScopedProjectStore } from "./scoped-project-protocol";
import { ScopedProjectRepository } from "./scoped-project-repository";
import { decideTelegramWriterLease } from "./telegram-writer-lease";

const binaryChecksum: BinaryChecksumPort = {
	async sha256Bytes(bytes) {
		const digest = new Uint8Array(
			await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
		);
		return Array.from(digest, (value) =>
			value.toString(16).padStart(2, "0"),
		).join("");
	},
};
const checksum: ChecksumPort = {
	sha256: (value) =>
		binaryChecksum.sha256Bytes(new TextEncoder().encode(value)),
};
async function candidate(): Promise<PublicationCandidate> {
	const createdAt = "2026-11-05T12:00:00.000Z",
		bytes = Uint8Array.of(81, 82, 83);
	const asset: CustomGlbAssetDefinition = {
		assetDefinitionId: "mixed-pin-model",
		displayName: "Exact local resource",
		format: "glb",
		resourceHash: await binaryChecksum.sha256Bytes(bytes),
		byteLength: bytes.byteLength,
		widthMm: 100,
		depthMm: 100,
		heightMm: 100,
	};
	const project = {
		...createInitialProject({
			projectId: "mixed-pin-project",
			levelId: "mixed-pin-level",
			name: "Mixed pin boundary",
			createdAt,
		}),
		assetDefinitionRefs: [asset],
	};
	expect(validateRuntimeV1Project(project).kind).toBe("accepted");
	const serializedProject = canonicalProjectSerializer.serialize(project);
	return {
		project,
		revision: {
			projectId: project.projectId,
			revisionId: "mixed-pin-r1",
			schemaVersion: 1,
			createdAt,
			serializedProject,
			checksum: await checksum.sha256(serializedProject),
		},
	};
}
function subject() {
	const boundary = {
		calls: 0,
		takeoverChanges: 0,
		failure: new Error("Owned store is unavailable"),
	};
	// Denial-only seam: never supplies Access, IDs, transaction events or a stored row.
	const storage: ScopedProjectStore = {
		async run() {
			boundary.calls++;
			throw boundary.failure;
		},
	};
	const repository = new ScopedProjectRepository(
		storage,
		{
			ownerId: "mixed-pin-owner",
			nowEpochMs: () => 1000,
			checksum,
			binaryChecksum,
			takeoverRequirements: {
				requiresExplicitTakeover: () => false,
				requireExplicitTakeover: () => {
					boundary.takeoverChanges++;
				},
				clearExplicitTakeoverRequirement: () => {
					boundary.takeoverChanges++;
				},
			},
		},
		{
			operationIdPrefix: (scope, kind) => `tma-v1:${scope}:${kind}:`,
			decideWriterLease: decideTelegramWriterLease,
		},
	);
	return { repository, boundary };
}
describe("mixed referenced and foreign pin input before owned store admission", () => {
	it("allows the exact referenced set to reach the denying store once without changing input", async () => {
		const source = await candidate(),
			hashes = [source.project.assetDefinitionRefs[0].resourceHash],
			before = structuredClone({ source, hashes }),
			{ repository, boundary } = subject();
		await expect(
			repository.pinStaging.begin(hashes, { candidate: source }),
		).rejects.toBe(boundary.failure);
		expect(boundary.calls).toBe(1);
		expect(boundary.takeoverChanges).toBe(0);
		expect({ source, hashes }).toStrictEqual(before);
	});
	it("refuses a mixed exact and unreferenced hash set before any owned store operation", async () => {
		const source = await candidate(),
			foreignHash = await binaryChecksum.sha256Bytes(Uint8Array.of(11, 12, 13)),
			hashes = [
				source.project.assetDefinitionRefs[0].resourceHash,
				foreignHash,
			],
			before = structuredClone({ source, hashes }),
			{ repository, boundary } = subject();
		expect(new Set(hashes).size).toBe(2);
		await expect(
			repository.pinStaging.begin(hashes, { candidate: source }),
		).rejects.toBeInstanceOf(Error);
		expect(boundary.calls).toBe(0);
		expect(boundary.takeoverChanges).toBe(0);
		expect({ source, hashes }).toStrictEqual(before);
	});
});

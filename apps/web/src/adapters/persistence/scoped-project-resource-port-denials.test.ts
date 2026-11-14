import { describe, expect, it } from "@rstest/core";
import type {
	BinaryChecksumPort,
	ChecksumPort,
	CustomAssetResource,
	WriterTakeoverRequirementStorePort,
} from "../../application/ports";
import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import { createInitialProject } from "../../domain/initial-project";
import type { CustomGlbAssetDefinition } from "../../domain/project";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import type { ScopedProjectStore } from "./scoped-project-protocol";
import { ScopedProjectRepository } from "./scoped-project-repository";
import { decideTelegramWriterLease } from "./telegram-writer-lease";

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
	sha256: (value) =>
		binaryChecksum.sha256Bytes(new TextEncoder().encode(value)),
};

async function referencedResource(): Promise<CustomAssetResource> {
	const instant = "2026-11-04T12:00:00.000Z";
	const ids = { nextValue: 0 };
	const configured = configureRectangularRoom(
		createInitialProject({
			projectId: "resource-port-project",
			levelId: "resource-port-level",
			name: "Resource port boundary",
			createdAt: instant,
		}),
		{ widthMm: "5000", depthMm: "4000", heightMm: "2600" },
		{ next: () => `resource-port-${ids.nextValue++}` },
		instant,
	);
	if (configured.kind !== "accepted")
		throw new Error("The independent domain fixture was refused");
	const resource = {
		bytes: new Uint8Array([81, 82, 83]),
		resourceHash: "",
	};
	resource.resourceHash = await binaryChecksum.sha256Bytes(resource.bytes);
	const asset: CustomGlbAssetDefinition = {
		assetDefinitionId: "resource-port-custom",
		displayName: "Referenced local resource",
		format: "glb",
		resourceHash: resource.resourceHash,
		byteLength: resource.bytes.byteLength,
		widthMm: 100,
		depthMm: 100,
		heightMm: 100,
	};
	expect(
		validateRuntimeV1Project({
			...configured.project,
			assetDefinitionRefs: [asset],
		}).kind,
	).toBe("accepted");
	return resource;
}

function subject() {
	const boundary = {
		calls: 0,
		failure: new Error("The owned storage boundary is unavailable"),
	};
	// This port never supplies Access, a transaction, a resource row, or a lease.
	const storage: ScopedProjectStore = {
		async run() {
			boundary.calls++;
			throw boundary.failure;
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
			ownerId: "resource-port-owner",
			nowEpochMs: () => 1000,
			takeoverRequirements,
			checksum,
			binaryChecksum,
		},
		{
			operationIdPrefix: (scope, kind) => `tma-v1:${scope}:${kind}:`,
			decideWriterLease: decideTelegramWriterLease,
		},
	);
	return { repository, boundary };
}

describe("unconditional resource operations cannot bypass scoped ownership", () => {
	it("refuses direct insertion of valid referenced bytes before any store admission", async () => {
		const resource = await referencedResource();
		const before = structuredClone(resource);
		const { repository, boundary } = subject();

		await expect(
			repository.resources.writeIfAbsent(resource),
		).rejects.toBeInstanceOf(Error);

		expect(boundary.calls).toBe(0);
		expect(resource).toStrictEqual(before);
	});

	it("refuses direct deletion of an actual resource address before any store admission", async () => {
		const resource = await referencedResource();
		const before = structuredClone(resource);
		const { repository, boundary } = subject();

		await expect(
			repository.resources.delete(resource.resourceHash),
		).rejects.toBeInstanceOf(Error);

		expect(boundary.calls).toBe(0);
		expect(resource).toStrictEqual(before);
	});

	it("allows a read of the same valid address to reach the unavailable store exactly once", async () => {
		const resource = await referencedResource();
		const before = structuredClone(resource);
		const { repository, boundary } = subject();

		await expect(
			repository.resources.read(resource.resourceHash),
		).rejects.toBe(boundary.failure);

		expect(boundary.calls).toBe(1);
		expect(resource).toStrictEqual(before);
	});
});

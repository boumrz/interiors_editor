import { expect, it } from "@rstest/core";
import { canonicalProjectSerializer } from "../../application/create-project";
import type {
	BinaryChecksumPort,
	ChecksumPort,
	PublicationCandidate,
} from "../../application/ports";
import { createInitialProject } from "../../domain/initial-project";
import { preflightStaticGlbImport } from "../../domain/static-glb-import";
import { BrowserRegisteredProjectExporter } from "./browser-registered-project-exporter";
import { createRegisteredRuntimePortablePorts } from "./registered-runtime-portable";

const binaryChecksum: BinaryChecksumPort = {
	async sha256Bytes(bytes) {
		const digest = await globalThis.crypto.subtle.digest(
			"SHA-256",
			Uint8Array.from(bytes).buffer,
		);
		return Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
	},
};
const checksum: ChecksumPort = {
	sha256: (text) => binaryChecksum.sha256Bytes(new TextEncoder().encode(text)),
};

/** Self-authored static geometry; no catalog, external URI or warm resource cache. */
function triangleGlb(): Uint8Array {
	const positions = new Float32Array([0, 0, 0, 0.7, 0, 0, 0, 0.8, 0.6]);
	const json = new TextEncoder().encode(
		JSON.stringify({
			asset: { version: "2.0", generator: "Browser export ownership proof" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			buffers: [{ byteLength: positions.byteLength }],
			bufferViews: [
				{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
			],
			accessors: [
				{
					bufferView: 0,
					componentType: 5126,
					count: 3,
					type: "VEC3",
					min: [0, 0, 0],
					max: [0.7, 0.8, 0.6],
				},
			],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
		}),
	);
	const paddedLength = Math.ceil(json.byteLength / 4) * 4;
	const bytes = new Uint8Array(28 + paddedLength + positions.byteLength);
	const view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.byteLength, true);
	view.setUint32(12, paddedLength, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.fill(32, 20, 20 + paddedLength);
	bytes.set(json, 20);
	view.setUint32(20 + paddedLength, positions.byteLength, true);
	view.setUint32(24 + paddedLength, 0x004e4942, true);
	bytes.set(new Uint8Array(positions.buffer), 28 + paddedLength);
	return bytes;
}

async function resourcefulCandidate(
	bytes: Uint8Array,
): Promise<PublicationCandidate> {
	const instant = "2026-11-05T12:00:00.000Z";
	const hash = await binaryChecksum.sha256Bytes(bytes);
	const project = {
		...createInitialProject({
			projectId: "stored-project",
			levelId: "level",
			name: "Owned resource snapshot",
			createdAt: instant,
		}),
		assetDefinitionRefs: [hash, hash.toUpperCase()].map(
			(resourceHash, index) => ({
				assetDefinitionId: `model-${index}`,
				displayName: "Self-authored triangle",
				format: "glb" as const,
				resourceHash,
				byteLength: bytes.byteLength,
				widthMm: 700,
				heightMm: 800,
				depthMm: 600,
			}),
		),
	};
	const serializedProject = canonicalProjectSerializer.serialize(project);
	return {
		project,
		revision: {
			projectId: project.projectId,
			revisionId: "durable-revision",
			schemaVersion: 1,
			createdAt: instant,
			serializedProject,
			checksum: await checksum.sha256(serializedProject),
		},
	};
}

function barrier() {
	let release: (() => void) | undefined;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return {
		promise,
		release: () => {
			if (!release) throw new Error("Barrier was not initialized");
			release();
		},
	};
}

it("does not read a resourceful Durable pin snapshot when cancellation predates export", async () => {
	const bytes = triangleGlb();
	expect(preflightStaticGlbImport(bytes).kind).toBe("accepted");
	const source = await resourcefulCandidate(bytes);
	const registered = createRegisteredRuntimePortablePorts({ binaryChecksum });
	let pinReads = 0;
	const exporter = new BrowserRegisteredProjectExporter({
		checksum,
		smoke: registered.smoke,
		writer: registered.writer,
		readPinnedSnapshot: async () => {
			pinReads++;
			return source.project.assetDefinitionRefs.map((ref) => ({
				resourceHash: ref.resourceHash,
				bytes: bytes.slice(),
			}));
		},
	});
	const cancellation = new AbortController();
	cancellation.abort();
	expect(await exporter.execute(source, cancellation.signal)).toEqual({
		kind: "rejected",
		reasonCode: "BACKUP_CANCELLED",
	});
	expect(pinReads).toBe(0);
});

it("exports the initially owned bytes for every raw hash alias when caller buffers change during the first checksum", async () => {
	const originalBytes = triangleGlb();
	expect(preflightStaticGlbImport(originalBytes).kind).toBe("accepted");
	const source = await resourcefulCandidate(originalBytes);
	const resources = source.project.assetDefinitionRefs.map((ref) => ({
		resourceHash: ref.resourceHash,
		bytes: originalBytes.slice(),
	}));
	const checksumEntered = barrier(),
		continueChecksum = barrier();
	let firstChecksum = true,
		pinReads = 0;
	const registered = createRegisteredRuntimePortablePorts({ binaryChecksum });
	const exporter = new BrowserRegisteredProjectExporter({
		checksum: {
			sha256: async (text) => {
				if (firstChecksum) {
					firstChecksum = false;
					checksumEntered.release();
					await continueChecksum.promise;
				}
				return checksum.sha256(text);
			},
		},
		smoke: registered.smoke,
		writer: registered.writer,
		readPinnedSnapshot: async () => {
			pinReads++;
			return resources;
		},
	});
	const exporting = exporter.execute(source);
	// A public early return/refusal must not leave the test waiting for a port
	// that the changed exporter never called. Both branches observe rejections.
	const completion = Promise.resolve(exporting).then(
		() => "completed" as const,
		() => "rejected" as const,
	);
	try {
		const stage = await Promise.race([
			checksumEntered.promise.then(() => "checksum-entered" as const),
			completion,
		]);
		expect(stage).toBe("checksum-entered");
		for (const [index, resource] of resources.entries())
			resource.bytes.fill(index + 1);
	} finally {
		continueChecksum.release();
	}
	const result = await exporting;
	expect(pinReads).toBe(1);
	expect(result.kind).toBe("ready");
	if (result.kind !== "ready")
		throw new Error("Initial owned resource snapshot was not exported");
	const decoded = await registered.decoder.decode(result.bytes);
	expect(decoded.kind).toBe("accepted");
	if (decoded.kind !== "accepted")
		throw new Error("Actual registered decoder rejected the owned archive");
	expect(decoded.projectMember?.project).toStrictEqual(source.project);
	expect(
		decoded.resources?.map((resource) => resource.resourceHash).sort(),
	).toEqual(
		source.project.assetDefinitionRefs.map((ref) => ref.resourceHash).sort(),
	);
	for (const resource of decoded.resources ?? []) {
		expect(resource.bytes).toEqual(originalBytes);
		expect(await binaryChecksum.sha256Bytes(resource.bytes)).toBe(
			await binaryChecksum.sha256Bytes(originalBytes),
		);
	}
	for (const resource of resources)
		expect(resource.bytes).not.toEqual(originalBytes);
});

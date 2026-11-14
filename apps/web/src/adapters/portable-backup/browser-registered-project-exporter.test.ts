import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../../domain/initial-project";
import { canonicalProjectSerializer } from "../../application/create-project";
import { createRegisteredRuntimePortablePorts } from "./registered-runtime-portable";
import { BrowserRegisteredProjectExporter } from "./browser-registered-project-exporter";
import type {
	CustomAssetResource,
	PublicationCandidate,
} from "../../application/ports";
const instant = "2026-11-04T12:00:00.000Z";
const binaryChecksum = {
	sha256Bytes: async (bytes: Uint8Array) =>
		[
			...new Uint8Array(
				await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
			),
		]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join(""),
};
const checksum = {
	sha256: (text: string) =>
		binaryChecksum.sha256Bytes(new TextEncoder().encode(text)),
};
async function candidate(): Promise<PublicationCandidate> {
	const project = createInitialProject({
			projectId: "stored-project",
			levelId: "level",
			name: "Empty durable",
			createdAt: instant,
		}),
		serializedProject = canonicalProjectSerializer.serialize(project);
	return {
		project,
		revision: {
			projectId: project.projectId,
			revisionId: "owned-revision",
			schemaVersion: 1,
			createdAt: instant,
			serializedProject,
			checksum: await checksum.sha256(serializedProject),
		},
	};
}
function exporter(
	readPinnedSnapshot: (
		definitions: PublicationCandidate["project"]["assetDefinitionRefs"],
	) => Promise<readonly CustomAssetResource[] | undefined>,
) {
	const registered = createRegisteredRuntimePortablePorts({ binaryChecksum });
	return {
		registered,
		exporter: new BrowserRegisteredProjectExporter({
			checksum,
			smoke: registered.smoke,
			writer: registered.writer,
			readPinnedSnapshot,
		}),
	};
}

describe("additional browser registered export", () => {
	it("formats an empty Durable Plan through the actual registered writer and strict decoder", async () => {
		let reads = 0;
		const actual = exporter(async () => {
			reads++;
			return [];
		});
		const source = await candidate(),
			before = structuredClone(source);
		const result = await actual.exporter.execute(source);
		expect(result.kind).toBe("ready");
		if (result.kind !== "ready") throw new Error("No wire file");
		const decoded = await actual.registered.decoder.decode(result.bytes);
		expect(decoded.kind).toBe("accepted");
		if (decoded.kind !== "accepted") throw new Error("No strict ingress");
		expect(decoded.projectMember?.project).toStrictEqual(source.project);
		expect(source).toStrictEqual(before);
		expect(reads).toBe(0);
	});
	it("does not turn unavailable pin proof or a throwing verifier into corrupt-file feedback", async () => {
		const source = await candidate(),
			ref = {
				assetDefinitionId: "model",
				displayName: "Model",
				format: "glb" as const,
				resourceHash: "a".repeat(64),
				byteLength: 1,
				widthMm: 100,
				depthMm: 100,
				heightMm: 100,
			};
		const project = { ...source.project, assetDefinitionRefs: [ref] },
			serializedProject = canonicalProjectSerializer.serialize(project),
			input = {
				project,
				revision: {
					...source.revision,
					serializedProject,
					checksum: await checksum.sha256(serializedProject),
				},
			};
		for (const mode of ["missing", "throws"]) {
			const actual = exporter(async () => {
				if (mode === "throws") throw new Error("No pin snapshot");
				return undefined;
			});
			expect(await actual.exporter.execute(input)).toEqual({
				kind: "verification-unavailable",
			});
		}
	});
	it("cancels before resource work and after a held readonly snapshot resolves", async () => {
		const source = await candidate(),
			actual = exporter(async () => {
				throw new Error("No read");
			});
		expect(await actual.exporter.execute(source, { aborted: true })).toEqual({
			kind: "rejected",
			reasonCode: "BACKUP_CANCELLED",
		});
	});
});

it("preserves exact signed zero, own undefined and UTF16 from the supplied owned snapshot through the real wire file", async () => {
	const { configureRectangularRoom } = await import(
		"../../domain/rectangular-room"
	);
	const base = await candidate();
	let id = 0;
	const configured = configureRectangularRoom(
		base.project,
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		{ next: () => `geometry-${++id}` },
		instant,
	);
	if (configured.kind !== "accepted") throw new Error("Bad room");
	const project = configured.project;
	Object.defineProperty(project.level, "levelId", {
		value: "level-\ud800",
		enumerable: true,
	});
	Object.defineProperty(project.level.rooms[0], "name", {
		value: undefined,
		enumerable: true,
	});
	Object.defineProperty(project.level.vertices[0], "xMm", {
		value: -0,
		enumerable: true,
	});
	const serializedProject = canonicalProjectSerializer.serialize(project),
		input = {
			project,
			revision: {
				...base.revision,
				serializedProject,
				checksum: await checksum.sha256(serializedProject),
			},
		};
	const actual = exporter(async () => {
			throw new Error("No resources");
		}),
		result = await actual.exporter.execute(input);
	expect(result.kind).toBe("ready");
	if (result.kind !== "ready") throw new Error("Exact source not represented");
	const decoded = await actual.registered.decoder.decode(result.bytes);
	expect(decoded.kind).toBe("accepted");
	if (decoded.kind !== "accepted") throw new Error("Wire rejected");
	expect(decoded.projectMember?.project).toStrictEqual(project);
	const valid = validateRuntimeV1Project(decoded.projectMember?.project);
	if (valid.kind !== "accepted") throw new Error("Wrong exact Project");
	expect(Object.is(valid.project.level.vertices[0].xMm, -0)).toBe(true);
	expect(Object.hasOwn(valid.project.level.rooms[0], "name")).toBe(true);
});

it("owns the exact resource snapshot, cancels after pin proof and treats verifier exceptions as unavailable", async () => {
	const base = await candidate(),
		json = new TextEncoder().encode('{"asset":{"version":"2.0"}} '),
		bytes = new Uint8Array(20 + json.byteLength),
		view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.length, true);
	view.setUint32(12, json.length, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.set(json, 20);
	const hash = await binaryChecksum.sha256Bytes(bytes),
		definitions = [hash, hash.toUpperCase()].map((resourceHash, index) => ({
			assetDefinitionId: `model-${index}`,
			displayName: "Exact model",
			format: "glb" as const,
			resourceHash,
			byteLength: bytes.length,
			widthMm: 100,
			depthMm: 100,
			heightMm: 100,
		})),
		project = { ...base.project, assetDefinitionRefs: definitions },
		serializedProject = canonicalProjectSerializer.serialize(project),
		input = {
			project,
			revision: {
				...base.revision,
				serializedProject,
				checksum: await checksum.sha256(serializedProject),
			},
		},
		resources = definitions.map((def) => ({
			resourceHash: def.resourceHash,
			bytes: bytes.slice(),
		}));
	const actual = exporter(async (expected) => {
		expect(expected).toStrictEqual(definitions);
		return resources;
	});
	const ready = await actual.exporter.execute(input);
	expect(ready.kind).toBe("ready");
	if (ready.kind !== "ready") throw new Error("Aliases not exported");
	const decoded = await actual.registered.decoder.decode(ready.bytes);
	expect(decoded.kind).toBe("accepted");
	if (decoded.kind !== "accepted") throw new Error("Aliases not decoded");
	expect(decoded.resources).toHaveLength(resources.length);
	for (const resource of resources)
		expect(
			decoded.resources?.find(
				(actual) => actual.resourceHash === resource.resourceHash,
			),
		).toStrictEqual(resource);
	const cancelled = { aborted: false },
		interrupted = exporter(async () => {
			cancelled.aborted = true;
			return resources;
		});
	expect(await interrupted.exporter.execute(input, cancelled)).toEqual({
		kind: "rejected",
		reasonCode: "BACKUP_CANCELLED",
	});
	const registered = createRegisteredRuntimePortablePorts({ binaryChecksum }),
		throwing = new BrowserRegisteredProjectExporter({
			checksum,
			readPinnedSnapshot: async () => resources,
			smoke: {
				verify: async () => {
					throw new Error("Verifier unavailable");
				},
			},
			writer: registered.writer,
		});
	expect(await throwing.execute(input)).toEqual({
		kind: "verification-unavailable",
	});
});

it("refuses unsupported, domain-invalid and incomplete pin snapshots before formatting", async () => {
	const base = await candidate(),
		json = new TextEncoder().encode('{"asset":{"version":"2.0"}} '),
		bytes = new Uint8Array(20 + json.length),
		view = new DataView(bytes.buffer);
	view.setUint32(0, 0x46546c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, bytes.length, true);
	view.setUint32(12, json.length, true);
	view.setUint32(16, 0x4e4f534a, true);
	bytes.set(json, 20);
	const hash = await binaryChecksum.sha256Bytes(bytes),
		ref = {
			assetDefinitionId: "model",
			displayName: "Model",
			format: "glb" as const,
			resourceHash: hash,
			byteLength: bytes.length,
			widthMm: 100,
			depthMm: 100,
			heightMm: 100,
		},
		project = { ...base.project, assetDefinitionRefs: [ref] },
		serializedProject = canonicalProjectSerializer.serialize(project),
		source = {
			project,
			revision: {
				...base.revision,
				serializedProject,
				checksum: await checksum.sha256(serializedProject),
			},
		};
	for (const resources of [
		[],
		[
			{ resourceHash: hash, bytes },
			{ resourceHash: hash, bytes },
		],
		[{ resourceHash: "f".repeat(64), bytes }],
		[{ resourceHash: hash, bytes: bytes.subarray(0, 1) }],
	])
		expect(
			await exporter(async () => resources).exporter.execute(source),
		).toEqual({ kind: "verification-unavailable" });
	for (const target of ["project", "revision"] as const) {
		const invalid = structuredClone(source);
		Reflect.set(invalid[target], "schemaVersion", 2);
		let reads = 0;
		expect(
			await exporter(async () => {
				reads++;
				throw new Error("Unsupported source may not read pins");
			}).exporter.execute(invalid),
		).toEqual({ kind: "rejected", reasonCode: "PORTABLE_BACKUP_UNSUPPORTED" });
		expect(reads).toBe(0);
	}
	const badProject = {
			...project,
			level: {
				...project.level,
				vertices: [
					{ vertexId: "a", xMm: 0, zMm: 0 },
					{ vertexId: "b", xMm: 100, zMm: 123 },
				],
				wallSegments: [
					{
						wallSegmentId: "w",
						startVertexId: "a",
						endVertexId: "b",
						thicknessMm: 100,
					},
				],
			},
		},
		validation = validateRuntimeV1Project(badProject);
	expect(validation.kind).toBe("rejected");
	let reads = 0;
	expect(
		await exporter(async () => {
			reads++;
			return [{ resourceHash: hash, bytes }];
		}).exporter.execute({ ...source, project: badProject }),
	).toEqual(validation);
	expect(reads).toBe(0);
});

import { expect, it } from "@rstest/core";
import { zipSync } from "fflate";
import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import { RuntimePortableBackupCodec } from "./runtime-portable-backup-codec";

it("decodes an independently constructed healthy ZIP through a captured public assertion, including any undefined rejection", async () => {
	// The fixture is prepared inside the case with standard ZIP primitives. Neither
	// the codec encoder nor its reader constructs the source this decoder must read.
	const createdAt = "2026-11-04T00:00:00.000Z";
	const project = {
		schemaVersion: 1,
		projectId: "independent-reader",
		name: "Independent healthy backup",
		createdAt,
		updatedAt: createdAt,
		lifecycle: "active",
		level: {
			levelId: "independent-level",
			vertices: [],
			wallSegments: [],
			rooms: [],
			openings: [],
		},
		assetInstances: [],
		assetDefinitionRefs: [],
	};
	const bytes = (value: unknown) =>
		new TextEncoder().encode(JSON.stringify(value));
	const schema = "interiors.project/runtime-v1-wire";
	const projectBytes = bytes({ ...project, projectSchemaId: schema });
	const checksum = {
		async sha256Bytes(value: Uint8Array): Promise<string> {
			const digest = new Uint8Array(
				await crypto.subtle.digest("SHA-256", value.slice().buffer),
			);
			return [...digest]
				.map((byte) => byte.toString(16).padStart(2, "0"))
				.join("");
		},
	};
	const path = "project/project.json";
	const sha256 = await checksum.sha256Bytes(projectBytes);
	const manifest = {
		backupFormat: "interiors-portable-backup",
		backupFormatVersion: 1,
		canonicalProjectPath: path,
		complete: true,
		createdAt,
		entries: [
			{
				byteLength: projectBytes.length,
				mediaType: "application/json",
				path,
				sha256,
			},
		],
		projectSchemaId: schema,
		projectSchemaVersion: 1,
		requiredCapabilities: [],
		resources: [],
		sourceProjectId: project.projectId,
	};
	const archive = zipSync(
		{
			"manifest.json": bytes(manifest),
			"checksums.json": bytes({
				algorithm: "sha-256",
				entries: [{ path, sha256 }],
			}),
			[path]: projectBytes,
		},
		{ level: 0 },
	);
	const codec = new RuntimePortableBackupCodec(
		checksum,
		validateRuntimeV1Project,
	);
	// .resolves turns even `throw undefined` into an ordinary marked assertion
	// failure, instead of exposing a reporter failure while formatting that value.
	await expect(codec.decode(archive)).resolves.toMatchObject({
		kind: "decoded",
		schema: "runtime-v1-wire",
		decodedProject: project,
		projectBytes,
		resources: [],
		metadata: {
			sourceProjectId: project.projectId,
			createdAt,
			projectSchemaId: schema,
			projectSchemaVersion: 1,
		},
	});
});

import { describe, expect, it } from "@rstest/core";

import { FflatePortableBackupEncoder } from "./fflate-portable-backup-encoder";
import {
	FflatePortableBackupDecoder,
	mapPpjA1SourceFailure,
} from "./fflate-portable-backup-decoder";
import { readPpjA1ZipCentralDirectory } from "./ppj-a1-zip-central-directory";
import { MAXIMUM_PPJ_A1_JSON_BYTES } from "../../domain/ppj-a1-lossless-json";

const encoder = new FflatePortableBackupEncoder();
const checksum = {
	sha256Bytes: async (bytes: Uint8Array) => `sum:${bytes.byteLength}`,
};

describe("FflatePortableBackupDecoder", () => {
	it("returns every manifest-bound custom GLB only after its path, byte length and SHA-256 binding agree", async () => {
		const projectBytes = utf8Bytes('{"projectId":"source-project"}');
		const resourceHash = "a".repeat(64);
		const glbBytes = Uint8Array.from([0x67, 0x6c, 0x54, 0x46]);
		const archive = customGlbArchive(projectBytes, resourceHash, glbBytes);

		await expect(
			new FflatePortableBackupDecoder({
				sha256Bytes: async (bytes) =>
					bytes === glbBytes || bytes[0] === 0x67
						? resourceHash
						: `sum:${bytes.byteLength}`,
			}).decode(archive),
		).resolves.toEqual({
			kind: "accepted",
			projectBytes,
			resources: [{ bytes: glbBytes, resourceHash }],
		});
	});

	it("rejects a custom GLB when its manifest, ledger or path hash would let unrelated bytes enter staging", async () => {
		const projectBytes = utf8Bytes('{"projectId":"source-project"}');
		const resourceHash = "a".repeat(64);
		const glbBytes = Uint8Array.from([0x67, 0x6c, 0x54, 0x46]);
		for (const archive of [
			customGlbArchive(projectBytes, resourceHash, glbBytes, {
				ledgerDigest: "b".repeat(64),
			}),
			customGlbArchive(projectBytes, resourceHash, glbBytes, {
				manifestByteLength: glbBytes.byteLength + 1,
			}),
			customGlbArchive(projectBytes, resourceHash, glbBytes, {
				manifestPath: `custom/${"b".repeat(64)}.glb`,
			}),
		]) {
			await expect(
				new FflatePortableBackupDecoder({
					sha256Bytes: async (bytes) =>
						bytes[0] === 0x67 ? resourceHash : `sum:${bytes.byteLength}`,
				}).decode(archive),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PORTABLE_BACKUP_INVALID",
			});
		}
	});

	it("returns the only manifest-declared canonical Project after validating its exact size and checksum", async () => {
		const projectBytes = utf8Bytes('{"projectId":"source-project"}');
		const archive = resourceFreeArchive(projectBytes);
		expect(readPpjA1ZipCentralDirectory(archive).kind).toBe("accepted");

		await expect(
			new FflatePortableBackupDecoder(checksum).decode(archive),
		).resolves.toEqual({ kind: "accepted", projectBytes });
	});

	it("rejects a declared canonical Project over 10 MiB before buffering or checksumming it", async () => {
		const projectBytes = utf8Bytes(
			`{"projectId":"source-project","padding":"${"x".repeat(
				MAXIMUM_PPJ_A1_JSON_BYTES,
			)}"}`,
		);
		const archive = resourceFreeArchive(projectBytes);
		let checksumCalls = 0;

		await expect(
			new FflatePortableBackupDecoder({
				sha256Bytes: async () => {
					checksumCalls += 1;
					return "must-not-be-called";
				},
			}).decode(archive),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_LIMIT_EXCEEDED",
		});
		expect(checksumCalls).toBe(0);
	});

	it("rejects an archive when its declared Project checksum does not match the exact member bytes", async () => {
		const projectBytes = utf8Bytes('{"projectId":"source-project"}');
		const archive = resourceFreeArchive(projectBytes, "sum:wrong");

		await expect(
			new FflatePortableBackupDecoder(checksum).decode(archive),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CHECKSUM_MISMATCH",
		});
	});

	it.each([
		["a newer schema version", { projectSchemaVersion: 2 }],
		["an unknown schema identifier", { projectSchemaId: "interiors.project/alpha-2" }],
	])("reports %s separately from a corrupt current backup", async (_label, options) => {
		const projectBytes = utf8Bytes('{"projectId":"source-project"}');
		const archive = resourceFreeArchive(projectBytes, undefined, {}, options);

		await expect(
			new FflatePortableBackupDecoder(checksum).decode(archive),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_FUTURE_SCHEMA",
		});
	});

	it.each([
		["another backup format", { backupFormat: "another-format" }],
		["another backup format version", { backupFormatVersion: 2 }],
		["another canonical path", { canonicalProjectPath: "project/future.json" }],
		["an incomplete marker", { complete: false }],
		["a non-string creation date", { createdAt: 42 }],
		["an empty schema identifier", { projectSchemaId: "" }],
		["a fractional schema version", { projectSchemaVersion: 2.5 }],
		["an empty source Project id", { sourceProjectId: "" }],
		["non-array entries", { entries: {} }],
		["non-array resources", { resources: {} }],
		["non-array capabilities", { requiredCapabilities: {} }],
		["an unexpected manifest field", { unexpected: true }],
	] as const)(
		"keeps a future-version manifest with %s on the corrupt-backup path",
		async (_label, malformedFutureManifest) => {
			const projectBytes = utf8Bytes('{"projectId":"source-project"}');
			const archive = resourceFreeArchive(projectBytes, undefined, {}, {
				projectSchemaVersion: 2,
				...malformedFutureManifest,
			});

			await expect(
				new FflatePortableBackupDecoder(checksum).decode(archive),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PORTABLE_BACKUP_INVALID",
			});
		},
	);

	it.each([
		["BACKUP_CANCELLED", "PORTABLE_BACKUP_CANCELLED"],
		["BACKUP_COMPRESSION_RATIO", "PORTABLE_BACKUP_LIMIT_EXCEEDED"],
		["BACKUP_CONTAINER_BYTES_LIMIT", "PORTABLE_BACKUP_LIMIT_EXCEEDED"],
		["BACKUP_ENTRY_LIMIT", "PORTABLE_BACKUP_LIMIT_EXCEEDED"],
		["BACKUP_UNPACKED_BYTES_LIMIT", "PORTABLE_BACKUP_LIMIT_EXCEEDED"],
		["BACKUP_CONTAINER_UNSUPPORTED", "PORTABLE_BACKUP_INVALID"],
	] as const)("maps %s to %s", (sourceReason, portableReason) => {
		expect(mapPpjA1SourceFailure(sourceReason)).toEqual({
			kind: "rejected",
			reasonCode: portableReason,
		});
	});

	it("maps a bounded ZIP entry-count rejection to the user-visible phone limit outcome", async () => {
		const entries = Object.fromEntries(
			Array.from({ length: 1_001 }, (_, index) => [
				`extra-${index}`,
				new Uint8Array(),
			]),
		);
		const archive = encoder.encode(entries);

		await expect(
			new FflatePortableBackupDecoder(checksum).decode(archive),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_LIMIT_EXCEEDED",
		});
	});

	it("quiesces a cancelled member read and returns the stable cancellation result", async () => {
		const projectBytes = utf8Bytes('{"projectId":"source-project"}');
		const archive = resourceFreeArchive(projectBytes);
		const controller = new AbortController();
		controller.abort();

		await expect(
			new FflatePortableBackupDecoder(checksum).decode(
				archive,
				controller.signal,
			),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_CANCELLED",
		});
	});

	it("rejects an archive with an unexpected resource rather than accepting a partial resource import", async () => {
		const projectBytes = utf8Bytes('{"projectId":"source-project"}');
		const archive = resourceFreeArchive(projectBytes, undefined, {
			"custom/model.glb": Uint8Array.from([1, 2, 3]),
		});

		await expect(
			new FflatePortableBackupDecoder(checksum).decode(archive),
		).resolves.toEqual({
			kind: "rejected",
			reasonCode: "PORTABLE_BACKUP_INVALID",
		});
	});

	it("rejects malformed containers and every manifest binding that does not describe the same canonical member", async () => {
		const projectBytes = utf8Bytes('{"projectId":"source-project"}');
		const invalidArchives = [
			Uint8Array.from([0x50, 0x4b]),
			resourceFreeArchive(
				projectBytes,
				undefined,
				{},
				{
					manifestByteLength: projectBytes.byteLength + 1,
				},
			),
			resourceFreeArchive(
				projectBytes,
				undefined,
				{},
				{
					ledgerDigest: "sum:different",
				},
			),
			resourceFreeArchive(
				projectBytes,
				undefined,
				{},
				{
					sourceProjectId: "another-project",
				},
			),
		];

		for (const archive of invalidArchives) {
			await expect(
				new FflatePortableBackupDecoder(checksum).decode(archive),
			).resolves.toEqual({
				kind: "rejected",
				reasonCode: "PORTABLE_BACKUP_INVALID",
			});
		}
	});
});

function utf8Bytes(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}

function resourceFreeArchive(
	projectBytes: Uint8Array,
	checksumOverride?: string,
	extraEntries: Readonly<Record<string, Uint8Array>> = {},
	options: {
		readonly backupFormat?: unknown;
		readonly backupFormatVersion?: unknown;
		readonly canonicalProjectPath?: unknown;
		readonly complete?: unknown;
		readonly createdAt?: unknown;
		readonly entries?: unknown;
		readonly ledgerDigest?: string;
		readonly manifestByteLength?: number;
		readonly projectSchemaId?: unknown;
		readonly projectSchemaVersion?: unknown;
		readonly requiredCapabilities?: unknown;
		readonly resources?: unknown;
		readonly sourceProjectId?: unknown;
		readonly unexpected?: unknown;
	} = {},
): Uint8Array {
	const digest = checksumOverride ?? `sum:${projectBytes.byteLength}`;
	const ledgerDigest = options.ledgerDigest ?? digest;
	const manifest = {
		backupFormat: options.backupFormat ?? "interiors-portable-backup",
		backupFormatVersion: options.backupFormatVersion ?? 1,
		canonicalProjectPath:
			options.canonicalProjectPath ?? "project/project.json",
		complete: options.complete ?? true,
		createdAt: options.createdAt ?? "2026-08-23T07:00:00.000Z",
		entries:
			options.entries ??
			[
				{
					byteLength: options.manifestByteLength ?? projectBytes.byteLength,
					mediaType: "application/json",
					path: "project/project.json",
					sha256: digest,
				},
			],
		projectSchemaId:
			options.projectSchemaId ?? "interiors.project/alpha-1",
		projectSchemaVersion: options.projectSchemaVersion ?? 1,
		requiredCapabilities: options.requiredCapabilities ?? [],
		resources: options.resources ?? [],
		sourceProjectId: options.sourceProjectId ?? "source-project",
		...(options.unexpected === undefined
			? {}
			: { unexpected: options.unexpected }),
	};
	return encoder.encode({
		"checksums.json": utf8Bytes(
			JSON.stringify({
				algorithm: "sha-256",
				entries: [{ path: "project/project.json", sha256: ledgerDigest }],
			}),
		),
		...extraEntries,
		"manifest.json": utf8Bytes(JSON.stringify(manifest)),
		"project/project.json": projectBytes,
	});
}

function customGlbArchive(
	projectBytes: Uint8Array,
	resourceHash: string,
	glbBytes: Uint8Array,
	options: {
		readonly ledgerDigest?: string;
		readonly manifestByteLength?: number;
		readonly manifestPath?: string;
	} = {},
): Uint8Array {
	const path = `custom/${resourceHash}.glb`;
	const manifestPath = options.manifestPath ?? path;
	const projectDigest = `sum:${projectBytes.byteLength}`;
	const resourceDigest = options.ledgerDigest ?? resourceHash;
	return encoder.encode({
		"checksums.json": utf8Bytes(
			JSON.stringify({
				algorithm: "sha-256",
				entries: [
					{ path: "project/project.json", sha256: projectDigest },
					{ path: manifestPath, sha256: resourceDigest },
				],
			}),
		),
		"manifest.json": utf8Bytes(
			JSON.stringify({
				backupFormat: "interiors-portable-backup",
				backupFormatVersion: 1,
				canonicalProjectPath: "project/project.json",
				complete: true,
				createdAt: "2026-08-23T07:00:00.000Z",
				entries: [
					{
						byteLength: projectBytes.byteLength,
						mediaType: "application/json",
						path: "project/project.json",
						sha256: projectDigest,
					},
					{
						byteLength: options.manifestByteLength ?? glbBytes.byteLength,
						mediaType: "model/gltf-binary",
						path: manifestPath,
						sha256: resourceHash,
					},
				],
				projectSchemaId: "interiors.project/alpha-1",
				projectSchemaVersion: 1,
				requiredCapabilities: [],
				resources: [{ path: manifestPath, resourceHash }],
				sourceProjectId: "source-project",
			}),
		),
		"project/project.json": projectBytes,
		[path]: glbBytes,
	});
}

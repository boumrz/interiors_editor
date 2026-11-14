import type {
	BinaryChecksumPort,
	CustomAssetResource,
	PortableBackupArchiveWriterPort,
	PortableBackupDecoderPort,
	PortableBackupSmokeCheckPort,
} from "../../application/ports";
import {
	assessBackupEnvelopeFeasibility,
	type BackupFeasibilityPolicyPort,
} from "../../application/backup-feasibility-policy";
import type { PortableBackupIngressReason } from "../../application/portable-backup-reasons";
import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import { preflightStaticGlbImport } from "../../domain/static-glb-import";
import { withNativeCancellation } from "./native-cancellation";
import { PortableBackupReadRenderSmokeCheck } from "./portable-backup-read-render-smoke";
import {
	RuntimePortableBackupCodec,
	type RuntimePortableProjectValidation,
} from "./runtime-portable-backup-codec";
import { encodeRuntimeV1Project } from "./runtime-v1-wire";

const MAXIMUM_NEW_CUSTOM_BYTES = 25 * 1024 * 1024;
type Validation = RuntimePortableProjectValidation<PortableBackupIngressReason>;

export interface RegisteredRuntimePortablePorts {
	readonly decoder: PortableBackupDecoderPort;
	readonly writer: PortableBackupArchiveWriterPort;
	readonly smoke: PortableBackupSmokeCheckPort;
	readonly feasibility: BackupFeasibilityPolicyPort;
}

/** Explicit registered V1 route; PPJ candidates never fall back to legacy readers. */
export function createRegisteredRuntimePortablePorts(dependencies: {
	readonly binaryChecksum: BinaryChecksumPort;
}): RegisteredRuntimePortablePorts {
	const checksum = dependencies.binaryChecksum;
	const decoder = new RuntimePortableBackupCodec(checksum, validateProject);
	return {
		decoder: {
			async decode(archive, signal) {
				try {
				const completed = await withNativeCancellation(signal, (native) =>
					decoder.decode(archive, native),
				);
				if (completed.kind === "cancelled") return cancelled();
				const result = completed.value;
				if (result.kind === "requires-ppj-validation")
					return { kind: "verification-unavailable" };
				if (result.kind === "rejected") return result;
				if (result.kind === "project-validation-rejected")
					return { kind: "rejected", reasonCode: result.reasonCode };
				const resources = preflightResources(result.resources);
				if (resources.kind === "rejected") return resources;
				return {
					kind: "accepted",
					projectBytes: result.projectBytes,
					projectMember: {
						format: result.schema,
						project: result.decodedProject,
					},
					resources: result.resources,
				};
				} catch {
					// File faults already have canonical outcomes. A verifier or adapter
					// failure must not become corrupt-file evidence in the old importer.
					return signal?.aborted ? cancelled() : { kind: "verification-unavailable" };
				}
			},
		},
		writer: {
			async encode(input, signal) {
				const completed = await withNativeCancellation(signal, (native) => {
					const encoder = new RuntimePortableBackupCodec(
						checksum,
						(project) => {
							const validation = validateProject(project);
							if (validation.kind === "rejected") return validation;
							// Codec snapshots Project and resource bytes before this synchronous
							// callback and before its first await. No caller callback intervenes.
							return preflightResources(input.resources);
						},
					);
					return encoder.encode(input, native);
				});
				if (completed.kind === "cancelled") return cancelled();
				const result = completed.value;
				return result.kind === "encoded"
					? { kind: "encoded", bytes: result.bytes, mimeType: result.mimeType }
					: { kind: "rejected", reasonCode: result.reasonCode };
			},
		},
		smoke: new PortableBackupReadRenderSmokeCheck({
			checksum,
			resourcePolicy: {
				maximumInputBytes: MAXIMUM_NEW_CUSTOM_BYTES,
				hashComparison: "sha256-bits",
			},
		}),
		feasibility: {
			async assess(candidate, resourcePorts) {
				if (
					typeof resourcePorts?.binaryChecksum?.sha256Bytes !== "function" ||
					typeof resourcePorts.resources?.read !== "function"
				)
					return {
						kind: "rejected",
						reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
					};
				const encoded = encodeRuntimeV1Project(candidate.project);
				if (
					encoded.kind === "rejected" ||
					validateProject(candidate.project).kind === "rejected"
				)
					return {
						kind: "rejected",
						reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
					};
				return assessBackupEnvelopeFeasibility(
					candidate,
					encoded.bytes.byteLength,
					resourcePorts,
				);
			},
		},
	};
}

function validateProject(project: unknown): Validation {
	const validation = validateRuntimeV1Project(project);
	if (validation.kind === "rejected") return validation;
	// New/untrusted Portable Backup creates references; the technical envelope's
	// 50 MiB cap is not custom admission. Reject before resource inflate or parse.
	if (
		validation.project.assetDefinitionRefs.some(
			(entry) => entry.byteLength > MAXIMUM_NEW_CUSTOM_BYTES,
		)
	)
		return { kind: "rejected", reasonCode: "GLB_FILE_BYTES_LIMIT" };
	return { kind: "accepted" };
}

function preflightResources(
	resources: readonly CustomAssetResource[],
): Validation {
	for (const resource of resources) {
		const result = preflightStaticGlbImport(resource.bytes);
		if (result.kind === "rejected") return result;
	}
	return { kind: "accepted" };
}

function cancelled(): {
	readonly kind: "rejected";
	readonly reasonCode: "BACKUP_CANCELLED";
} {
	return { kind: "rejected", reasonCode: "BACKUP_CANCELLED" };
}

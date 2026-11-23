import { serializeProjectCanonically } from "../domain/canonical-serialization";
import { parsePpjA1JsonBytes } from "../domain/ppj-a1-lossless-json";
import type { PortableBackupIngressReason } from "./portable-backup-reasons";
import {
	PROJECT_SCHEMA_VERSION,
	type Project,
	type Revision,
} from "../domain/project";
import { isStructurallyValidProjectV1 } from "../domain/project-json-transfer";
import { copyProject } from "../domain/copy-project";
import type {
	BinaryChecksumPort,
	CancellationSignalPort,
	ChecksumPort,
	ClockPort,
	CustomAssetResource,
	CustomAssetResourceStorePort,
	IdPort,
	PinStagingLease,
	PinStagingLeasePort,
	PortableBackupDecoderPort,
	PortableBackupSmokeCheckPort,
	PortableBackupImportAdmissionPort,
	PortableBackupImportAdmissionFailure,
	PortableBackupImportProfilePort,
	ProjectRepositoryPort,
	ProjectSerializerPort,
	PublicationCandidate,
} from "./ports";

export type ImportPortableBackupStatus =
	| { readonly kind: "validating" }
	| {
			readonly completed: number;
			readonly kind: "staging-resources";
			readonly total: number;
	  }
	| { readonly kind: "checking-render" }
	| { readonly kind: "saving" }
	| { readonly kind: "saved"; readonly candidate: PublicationCandidate }
	| {
			readonly kind: "persist-failed";
			reasonCode: import("./ports").PublicationFailureReason;
			candidate: PublicationCandidate;
	  };

export type ImportPortableBackupResult =
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "PORTABLE_BACKUP_CANCELLED"
				| "PORTABLE_BACKUP_CHECKSUM_MISMATCH"
				| "PORTABLE_BACKUP_FUTURE_SCHEMA"
				| "PORTABLE_BACKUP_LIMIT_EXCEEDED"
				| "PORTABLE_BACKUP_INVALID"
				| PortableBackupIngressReason;
	  }
	| { readonly kind: "verification-unavailable" }
	| {
			readonly kind: "durable";
			readonly projectId: string;
			readonly revisionId: string;
	  }
	| {
			readonly kind: "persist-failed";
			reasonCode: import("./ports").PublicationFailureReason;
	  };

interface ImportPortableBackupDependencies {
	readonly admission?: PortableBackupImportAdmissionPort;
	readonly binaryChecksum?: BinaryChecksumPort;
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly decoder: PortableBackupDecoderPort;
	readonly ids: IdPort;
	readonly pinStaging?: PinStagingLeasePort;
	readonly repository: ProjectRepositoryPort<
		import("./ports").PublicationFailureReason
	>;
	readonly resources?: CustomAssetResourceStorePort;
	readonly serializer: ProjectSerializerPort;
	readonly smoke: PortableBackupSmokeCheckPort;
}

/**
 * Publishes a verified Portable Backup only as a separate Project. Exact custom
 * bytes are staged first. A failed publication retains them for the pending
 * candidate's retry/export; cancellation and validation failures compensate
 * only this import's bytes and never change an existing card.
 */
export class ImportPortableBackupUseCase {
	public constructor(
		private readonly dependencies: ImportPortableBackupDependencies,
	) {}

	public async execute(
		archive: Uint8Array,
		onStatus: (status: ImportPortableBackupStatus) => void,
		signal?: CancellationSignalPort,
	): Promise<ImportPortableBackupResult> {
		onStatus({ kind: "validating" });
		if (signal?.aborted) return cancelled();
		const decoded = await this.dependencies.decoder.decode(archive, signal);
		if (decoded.kind !== "accepted") return decoded;
		if (signal?.aborted) return cancelled();

		let source =
			decoded.projectMember === undefined
				? decodeCanonicalProject(decoded.projectBytes)
				: decodeRegisteredProjectMember(decoded.projectMember);
		if (!source) {
			return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
		}
		const resources = resourcesForProject(source, decoded.resources);
		if (!resources) {
			return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
		}
		let preparedCandidate: PublicationCandidate | undefined;
		let profile: PortableBackupImportProfilePort | undefined;
		if (
			this.dependencies.pinStaging?.requiresPublicationContext ||
			this.dependencies.admission
		) {
			onStatus({ kind: "checking-render" });
			let passed = false;
			try {
				passed = await this.dependencies.smoke.verify(source, resources);
			} catch {
				if (this.dependencies.admission)
					return signal?.aborted
						? cancelled()
						: { kind: "verification-unavailable" };
			}
			if (signal?.aborted) return cancelled();
			if (!passed)
				return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
			if (this.dependencies.admission) {
				try {
					const admitted = await this.dependencies.admission.prepare(
						decoded,
						source,
						resources,
						signal,
					);
					if (signal?.aborted) return cancelled();
					if (admitted.kind !== "accepted") return admitted;
					profile = admitted.profile;
					source = profile.source;
					const candidate = await this.prepareImportedCandidate(source, profile, signal);
					if ("kind" in candidate) return candidate;
					const sealed = await profile.seal(candidate, signal);
					if (signal?.aborted) return cancelled();
					if (sealed.kind !== "accepted") return sealed;
					preparedCandidate = sealed.candidate;
				} catch {
					return signal?.aborted
						? cancelled()
						: { kind: "verification-unavailable" };
				}
			} else preparedCandidate = await this.prepareImportedCandidate(source);
			if (signal?.aborted) return cancelled();
		}
		onStatus({
			completed: 0,
			kind: "staging-resources",
			total: resources.length,
		});
		const staged = await this.stageResources(resources, signal, (completed) =>
			onStatus({
				completed,
				kind: "staging-resources",
				total: resources.length,
			}),
			preparedCandidate,
		);
		if (staged.kind === "cancelled") return cancelled();
		if (staged.kind === "failed") {
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		}
		if (signal?.aborted) {
			await this.discardStagedResources(staged);
			return cancelled();
		}

		if (!preparedCandidate) {
		onStatus({ kind: "checking-render" });
		let smokePassed = false;
		try {
			smokePassed = await this.dependencies.smoke.verify(source, resources);
		} catch {
			smokePassed = false;
		}
		if (signal?.aborted) {
			await this.discardStagedResources(staged);
			return cancelled();
		}
		if (!smokePassed) {
			await this.discardStagedResources(staged);
			return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_INVALID" };
		}
		}
		const candidate = preparedCandidate ?? await this.prepareImportedCandidate(source);
		const { project, revision } = candidate;
		if (signal?.aborted) {
			await this.discardStagedResources(staged);
			return cancelled();
		}
		if (staged.lease) {
			try {
				await this.dependencies.pinStaging?.markForPublication(
					staged.lease,
					{ projectId: project.projectId, revisionId: revision.revisionId },
				);
			} catch {
				await this.discardStagedResources(staged);
				return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
			}
		}
		if (signal?.aborted) {
			await this.discardStagedResources(staged);
			return cancelled();
		}
		onStatus({ kind: "saving" });
		if (signal?.aborted) {
			await this.discardStagedResources(staged);
			return cancelled();
		}
		if (profile) {
			let verified: Awaited<
				ReturnType<PortableBackupImportProfilePort["beforePublish"]>
			>;
			try {
				verified = await profile.beforePublish(candidate, signal);
			} catch {
				verified = { kind: "verification-unavailable" } as const;
			}
			if (signal?.aborted) {
				await this.discardStagedResources(staged);
				return cancelled();
			}
			if (verified.kind !== "accepted") {
				await this.discardStagedResources(staged);
				return verified;
			}
		}
		let publication: Awaited<ReturnType<typeof this.dependencies.repository.publish>>;
		try {
			publication = await this.dependencies.repository.publish(candidate);
		} catch {
			const failure = { kind: "persist-failed" as const, reasonCode: "PERSISTENCE_WRITE_FAILED" as const };
			onStatus({ ...failure, candidate });
			return failure;
		}
		if (publication.kind === "persist-failed") {
			// Keep exact resources rooted for the pending candidate's retry/export.
			// A restart reconciles its journal against the final durable pointer.
			onStatus({ ...publication, candidate });
			return publication;
		}
		if (staged.lease) {
			try {
				await this.dependencies.pinStaging?.complete(staged.lease);
			} catch {
				// A published pointer proves the resource roots. Retain the durable
				// lease for startup reconciliation rather than deleting valid bytes.
			}
		}
		onStatus({ candidate, kind: "saved" });
		return {
			kind: "durable",
			projectId: project.projectId,
			revisionId: revision.revisionId,
		};
	}

	private prepareImportedCandidate(source: Project): Promise<PublicationCandidate>;
	private prepareImportedCandidate(source: Project, profile: PortableBackupImportProfilePort, signal?: CancellationSignalPort): Promise<PublicationCandidate | PortableBackupImportAdmissionFailure>;
	private async prepareImportedCandidate(source: Project, profile?: PortableBackupImportProfilePort, signal?: CancellationSignalPort): Promise<PublicationCandidate | PortableBackupImportAdmissionFailure> {
		const now = this.dependencies.clock.now();
		let projectId = this.dependencies.ids.next();
		if (profile?.selectProjectId) {
			const selected = await profile.selectProjectId(projectId, signal);
			if (signal?.aborted) return cancelled();
			if (selected.kind !== "selected") return selected;
			projectId = selected.projectId;
		}
		const project: Project = { ...source, projectId, updatedAt: now };
		const serializedProject = this.dependencies.serializer.serialize(project);
		const revision: Revision = { checksum: await this.dependencies.checksum.sha256(serializedProject), createdAt: now, projectId: project.projectId, revisionId: this.dependencies.ids.next(), schemaVersion: PROJECT_SCHEMA_VERSION, serializedProject };
		return { project, revision };
	}

	private async stageResources(
		resources: readonly CustomAssetResource[],
		signal: CancellationSignalPort | undefined,
		onProgress: (completed: number) => void,
		preparedCandidate?: PublicationCandidate,
	): Promise<
		| {
				readonly hashes: readonly string[];
				readonly kind: "staged";
				readonly lease?: PinStagingLease;
		  }
		| { readonly kind: "cancelled" }
		| { readonly kind: "failed" }
	> {
		if (signal?.aborted) return { kind: "cancelled" };
		if (resources.length === 0) return { hashes: [], kind: "staged" };
		const store = this.dependencies.resources;
		if (!store) return { kind: "failed" };
		if (this.dependencies.pinStaging?.requiresPublicationContext) {
			if (!preparedCandidate || !store.writeIfAbsentPinned) return { kind: "failed" };
			let lease: PinStagingLease | undefined;
			const hashes: string[] = [];
			try {
				lease = await this.dependencies.pinStaging.begin(resources.map((resource) => resource.resourceHash), { candidate: preparedCandidate });
				for (const [index, resource] of resources.entries()) {
					if (signal?.aborted) throw new ImportCancelledError();
					const result = await store.writeIfAbsentPinned({ resourceHash: resource.resourceHash, bytes: resource.bytes.slice() }, lease.leaseId);
					if (result.kind === "stored") hashes.push(resource.resourceHash);
					else if (!(await this.isExistingResourceExact(resource))) throw new Error("Existing resource cannot prove its immutable address");
					if (signal?.aborted) throw new ImportCancelledError();
					onProgress(index + 1);
				}
				return { kind: "staged", hashes, lease };
			} catch (error) {
				if (lease) await this.discardStagedResources({ hashes, lease });
				return { kind: error instanceof ImportCancelledError ? "cancelled" : "failed" };
			}
		}
		const resourcesToWrite: CustomAssetResource[] = [];
		try {
			for (const resource of resources) {
				const existing = await store.read(resource.resourceHash);
				if (existing) {
					if (!(await this.isExistingResourceExact(resource))) {
						return { kind: "failed" };
					}
					if (store.protectExistingResource) {
						if (!(await store.protectExistingResource(resource.resourceHash))) return { kind: "failed" };
					} else {
						// A read alone cannot revoke an earlier writer's cleanup right.
						return { kind: "failed" };
					}
				} else {
					resourcesToWrite.push(resource);
				}
			}
		} catch {
			return { kind: "failed" };
		}
		let lease: PinStagingLease | undefined;
		if (resourcesToWrite.length > 0 && this.dependencies.pinStaging) {
			try {
				lease = await this.dependencies.pinStaging.begin(
					resourcesToWrite.map((resource) => resource.resourceHash),
				);
			} catch {
				return { kind: "failed" };
			}
		}
		const newlyStored: string[] = [];
		try {
			for (const [index, resource] of resourcesToWrite.entries()) {
				if (signal?.aborted) throw new ImportCancelledError();
				const stagedResource = {
					bytes: resource.bytes.slice(),
					resourceHash: resource.resourceHash,
				};
				const result = lease && store.writeIfAbsentPinned
					? await store.writeIfAbsentPinned(stagedResource, lease.leaseId)
					: await store.writeIfAbsent(stagedResource);
				if (result.kind === "stored") {
					newlyStored.push(resource.resourceHash);
				} else if (!(await this.isExistingResourceExact(resource))) {
					throw new Error("Existing resource cannot prove its immutable address.");
				}
				if (signal?.aborted) throw new ImportCancelledError();
				onProgress(index + 1);
			}
			for (let index = resourcesToWrite.length; index < resources.length; index += 1) {
				onProgress(index + 1);
			}
			return { hashes: newlyStored, kind: "staged", ...(lease ? { lease } : {}) };
		} catch (error) {
			await this.discardStagedResources({
				hashes: newlyStored,
				...(lease ? { lease } : {}),
			});
			return error instanceof ImportCancelledError || signal?.aborted
				? { kind: "cancelled" }
				: { kind: "failed" };
		}
	}

	private async discardStagedResources(staged: {
		readonly hashes: readonly string[];
		readonly lease?: PinStagingLease;
	}): Promise<void> {
		if (staged.lease && this.dependencies.pinStaging) {
			try {
				await this.dependencies.pinStaging.discard(staged.lease);
				return;
			} catch {
				// Keep the durable lease for restart recovery; do not issue an
				// unjournaled delete across the resource store.
				return;
			}
		}
		await this.removeStagedResources(staged.hashes);
	}

	private async isExistingResourceExact(
		resource: CustomAssetResource,
	): Promise<boolean> {
		const store = this.dependencies.resources;
		const checksum = this.dependencies.binaryChecksum;
		if (!store || !checksum) return false;
		const existing = await store.read(resource.resourceHash);
		return Boolean(
			existing &&
			existing.byteLength === resource.bytes.byteLength &&
			(await checksum.sha256Bytes(existing)) === resource.resourceHash,
		);
	}

	private async removeStagedResources(resourceHashes: readonly string[]): Promise<void> {
		const store = this.dependencies.resources;
		if (!store) return;
		await Promise.all(
			resourceHashes.map(async (resourceHash) => {
				try {
					await store.delete(resourceHash);
				} catch {
					// The Project has not been published, so a failed best-effort cleanup
					// can leave only an unreachable immutable cache entry.
				}
			}),
		);
	}
}

class ImportCancelledError extends Error {}

function cancelled(): Extract<
	ImportPortableBackupResult,
	{ readonly kind: "rejected" }
> {
	return { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" };
}

function resourcesForProject(
	project: Project,
	decoded: readonly CustomAssetResource[] | undefined,
): readonly CustomAssetResource[] | undefined {
	const resources = decoded ?? [];
	if (project.assetDefinitionRefs.length !== resources.length) return undefined;
	const definitions = new Map(
		project.assetDefinitionRefs.map((definition) => [definition.resourceHash, definition]),
	);
	if (definitions.size !== project.assetDefinitionRefs.length) return undefined;
	const seen = new Set<string>();
	for (const resource of resources) {
		const definition = definitions.get(resource.resourceHash);
		if (
			!definition ||
			seen.has(resource.resourceHash) ||
			resource.bytes.byteLength !== definition.byteLength
		) {
			return undefined;
		}
		seen.add(resource.resourceHash);
	}
	return resources.map((resource) => ({
		bytes: resource.bytes.slice(),
		resourceHash: resource.resourceHash,
	}));
}

function decodeCanonicalProject(bytes: Uint8Array): Project | undefined {
	if (parsePpjA1JsonBytes(bytes).kind === "rejected") return undefined;
	try {
		const raw = decodeUtf8(bytes);
		const parsed: unknown = JSON.parse(raw);
		if (!isStructurallyValidProjectV1(parsed) || hasExactFloorYaw(parsed)) return undefined;
		return raw === serializeProjectCanonically(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

/** Wire wrappers carry values that a raw JSON.parse cannot preserve. */
function decodeRegisteredProjectMember(member: { readonly format: string; readonly project: unknown }): Project | undefined {
	if (member.format !== "runtime-v1-wire" && member.format !== "runtime-v1-floor-yaw" && member.format !== "runtime-v1-legacy") return undefined;
	try {
		const project = member.project;
		if (!isStructurallyValidProjectV1(project) || hasExactFloorYaw(project) !== (member.format === "runtime-v1-floor-yaw")) return undefined;
		return copyProject(project);
	} catch { return undefined; }
}

function hasExactFloorYaw(project: Project): boolean {
	return project.assetInstances.some((item) => Object.hasOwn(item, "yawMilliDeg"));
}

function decodeUtf8(bytes: Uint8Array): string {
	const TextDecoderConstructor = (
		globalThis as typeof globalThis & {
			readonly TextDecoder?: new (
				label?: string,
				options?: { readonly fatal?: boolean },
			) => { decode(input: Uint8Array): string };
		}
	).TextDecoder;
	if (!TextDecoderConstructor) throw new Error("UTF-8 decoding is unavailable");
	return new TextDecoderConstructor("utf-8", { fatal: true }).decode(bytes);
}

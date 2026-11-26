import { supportedItemConflict } from "../domain/interior-support";
import {
	createCustomGlbFloorItem,
	createCustomGlbWallItem,
	type CreateCustomGlbWallItemInput,
	type CreateCustomGlbWallItemResult,
	type CreateCustomGlbFloorItemInput,
	type CreateCustomGlbFloorItemResult,
} from "../domain/custom-glb-asset";
import {
	preflightStaticGlbImport,
	type StaticGlbImportPreflight,
} from "../domain/static-glb-import";
import { PROJECT_SCHEMA_VERSION, type Revision } from "../domain/project";
import type { ParametricWallItemPlacementWarning } from "../domain/parametric-wall-item";
import type {
	FloorItemCollisionPolicy,
	ParametricFloorItemPlacementWarning,
} from "../domain/parametric-item";
import {
	assessBackupFeasibility,
	type BackupFeasibilityPolicyPort,
} from "./backup-feasibility-policy";
import { copyProject } from "../domain/copy-project";
import { sameSha256ResourceHashBits } from "../domain/resource-hash";
import type {
	BinaryChecksumPort,
	CancellationSignalPort,
	ChecksumPort,
	ClockPort,
	CustomAssetResourceStorePort,
	IdPort,
	PinStagingLease,
	PinStagingLeasePort,
	ProjectRepositoryPort,
	ProjectSerializerPort,
	PublicationCandidate,
} from "./ports";

export interface CreateCustomGlbFloorItemInputWithBytes
	extends CreateCustomGlbFloorItemInput {
	readonly glbBytes: Uint8Array;
}

export type CreateCustomGlbItemInputWithBytes =
	| CreateCustomGlbFloorItemInputWithBytes
	| (CreateCustomGlbWallItemInput & {
			readonly anchorClass: "wall";
			readonly glbBytes: Uint8Array;
	  });

function isWallInput(
	input: CreateCustomGlbItemInputWithBytes,
): input is CreateCustomGlbWallItemInput & {
	readonly anchorClass: "wall";
	readonly glbBytes: Uint8Array;
} {
	return "anchorClass" in input && input.anchorClass === "wall";
}

export type CreateCustomGlbFloorItemStatus =
	| { readonly kind: "saving" }
	| { readonly candidate: PublicationCandidate; readonly kind: "saved" }
	| {
			readonly candidate: PublicationCandidate;
			readonly kind: "persist-failed";
			readonly reasonCode: import("./ports").PublicationFailureReason;
	  };

export type CreateCustomGlbFloorItemUseCaseResult =
	| Exclude<
			CreateCustomGlbFloorItemResult | CreateCustomGlbWallItemResult,
			{ readonly kind: "accepted" }
	  >
	| Extract<StaticGlbImportPreflight, { readonly kind: "rejected" }>
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "CUSTOM_ASSET_BYTES_MISMATCH"
				| "PROJECT_BACKUP_ENVELOPE_EXCEEDED"
				| "RESOURCE_HASH_MISMATCH";
	  }
	| { readonly kind: "cancelled" }
	| {
			readonly kind: "durable";
			readonly projectId: string;
			readonly revisionId: string;
			readonly warnings?: readonly (
				| ParametricWallItemPlacementWarning
				| ParametricFloorItemPlacementWarning
			)[];
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: import("./ports").PublicationFailureReason;
	  };

interface CreateCustomGlbFloorItemDependencies {
	readonly backupFeasibility?: BackupFeasibilityPolicyPort;
	readonly floorItemCollisionPolicy?: FloorItemCollisionPolicy;
	readonly binaryChecksum: BinaryChecksumPort;
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly pinStaging?: PinStagingLeasePort;
	readonly repository: ProjectRepositoryPort<
		import("./ports").PublicationFailureReason
	>;
	readonly resources: CustomAssetResourceStorePort;
	readonly serializer: ProjectSerializerPort;
}

/**
 * Publishes a reference only after the immutable bytes are locally pinned and
 * backup-feasible. The pin journal survives the cross-store crash window
 * between byte write and Project publication.
 */
export class CreateCustomGlbFloorItemUseCase {
	public constructor(
		private readonly dependencies: CreateCustomGlbFloorItemDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		source: CreateCustomGlbItemInputWithBytes,
		onStatus: (status: CreateCustomGlbFloorItemStatus) => void,
		signal?: CancellationSignalPort,
	): Promise<CreateCustomGlbFloorItemUseCaseResult> {
		if (signal?.aborted) return { kind: "cancelled" };
		const glbBytes = source.glbBytes.slice();
		const input = { ...source, asset: { ...source.asset }, glbBytes };
		const preflight = preflightStaticGlbImport(glbBytes);
		if (preflight.kind === "rejected") return preflight;
		if (input.asset.byteLength !== glbBytes.byteLength) {
			return { kind: "rejected", reasonCode: "CUSTOM_ASSET_BYTES_MISMATCH" };
		}
		const computedResourceHash =
			await this.dependencies.binaryChecksum.sha256Bytes(glbBytes);
		if (
			!sameSha256ResourceHashBits(
				input.asset.resourceHash,
				computedResourceHash,
			)
		) {
			return { kind: "rejected", reasonCode: "RESOURCE_HASH_MISMATCH" };
		}
		const actualResourceHash = input.asset.resourceHash;
		const updated = isWallInput(input)
			? createCustomGlbWallItem(
					base.project,
					input,
					this.dependencies.ids,
					this.dependencies.clock.now(),
				)
			: createCustomGlbFloorItem(
					base.project,
					input,
					this.dependencies.ids,
					this.dependencies.clock.now(),
					this.dependencies.floorItemCollisionPolicy,
				);
		if (updated.kind === "rejected") return updated;
		const conflictAssetInstanceId = supportedItemConflict(updated.project);
		if (conflictAssetInstanceId !== undefined)
			return { kind: "rejected", reasonCode: isWallInput(input) ? "WALL_ITEM_COLLISION" : "ITEM_COLLISION", conflictAssetInstanceId };


		const project = this.dependencies.backupFeasibility
			? copyProject(updated.project)
			: updated.project;
		const serializedProject = this.dependencies.serializer.serialize(project);
		const revision: Revision = {
			checksum: await this.dependencies.checksum.sha256(serializedProject),
			createdAt: updated.project.updatedAt,
			projectId: updated.project.projectId,
			revisionId: this.dependencies.ids.next(),
			schemaVersion: PROJECT_SCHEMA_VERSION,
			serializedProject,
		};
		const candidate = { project, revision };
		const resource = {
			bytes: glbBytes,
			resourceHash: actualResourceHash,
		};
		let lease: PinStagingLease | undefined;
		let stored: { readonly kind: "already-present" | "stored" } | undefined;
		try {
			if (
				this.dependencies.pinStaging?.requiresPublicationContext &&
				!this.dependencies.resources.writeIfAbsentPinned
			) {
				throw new Error(
					"Strong resource storage requires atomic pinned writes",
				);
			}
			if (this.dependencies.pinStaging) {
				lease = this.dependencies.pinStaging.requiresPublicationContext
					? await this.dependencies.pinStaging.begin([actualResourceHash], {
							candidate,
							expectedBaseRevisionId: base.revision.revisionId,
						})
					: await this.dependencies.pinStaging.begin([actualResourceHash]);
			}
			stored =
				lease && this.dependencies.resources.writeIfAbsentPinned
					? await this.dependencies.resources.writeIfAbsentPinned(
							resource,
							lease.leaseId,
						)
					: await this.dependencies.resources.writeIfAbsent(resource);
			if (signal?.aborted) {
				await this.discardStagedResource(actualResourceHash, stored, lease);
				return { kind: "cancelled" };
			}
			const resourcePorts = {
				binaryChecksum: this.dependencies.binaryChecksum,
				resources: this.dependencies.resources,
			};
			const feasibility = await (this.dependencies.backupFeasibility
				? this.dependencies.backupFeasibility.assess(candidate, resourcePorts)
				: assessBackupFeasibility(candidate, resourcePorts));
			if (feasibility.kind === "rejected") {
				await this.discardStagedResource(actualResourceHash, stored, lease);
				return feasibility;
			}
			if (lease) {
				await this.dependencies.pinStaging?.markForPublication(lease, {
					projectId: updated.project.projectId,
					revisionId: revision.revisionId,
				});
			}
			if (signal?.aborted) {
				await this.discardStagedResource(actualResourceHash, stored, lease);
				return { kind: "cancelled" };
			}
		} catch {
			await this.discardStagedResource(actualResourceHash, stored, lease);
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		}
		if (signal?.aborted) {
			await this.discardStagedResource(actualResourceHash, stored, lease);
			return { kind: "cancelled" };
		}
		onStatus({ kind: "saving" });
		let publication: Awaited<
			ReturnType<typeof this.dependencies.repository.publish>
		>;
		try {
			publication = await this.dependencies.repository.publish(
				candidate,
				base.revision.revisionId,
			);
		} catch {
			const failure = {
				kind: "persist-failed" as const,
				reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
			};
			onStatus({ ...failure, candidate });
			return failure;
		}
		if (publication.kind === "persist-failed") {
			// A retained unpublished candidate still needs its exact bytes for retry/export.
			// Startup reconciliation completes or discards the marked lease after restart.
			onStatus({ ...publication, candidate });
			return publication;
		}
		if (lease) {
			try {
				await this.dependencies.pinStaging?.complete(lease);
			} catch {
				// The durable pointer is now the resource root. Keep the journal so
				// startup reconciliation can finish the hand-off safely.
			}
		}
		onStatus({ candidate, kind: "saved" });
		return {
			kind: "durable",
			projectId: updated.project.projectId,
			revisionId: revision.revisionId,
			...("warnings" in updated && updated.warnings !== undefined
				? { warnings: updated.warnings }
				: {}),
		};
	}

	private async discardStagedResource(
		resourceHash: string,
		stored: { readonly kind: "already-present" | "stored" } | undefined,
		lease: PinStagingLease | undefined,
	): Promise<void> {
		if (lease && this.dependencies.pinStaging) {
			try {
				await this.dependencies.pinStaging.discard(lease);
			} catch {
				// Retain the durable lease for startup recovery; an unjournaled delete
				// could remove bytes owned by a concurrent publication.
			}
			return;
		}
		if (stored?.kind !== "stored") return;
		try {
			await this.dependencies.resources.delete(resourceHash);
		} catch {
			// The candidate was never published; later GC may reclaim only this
			// unreachable immutable cache entry.
		}
	}
}

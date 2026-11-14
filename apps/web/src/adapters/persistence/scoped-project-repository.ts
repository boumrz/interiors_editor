import type {
	CustomAssetResource,
	CustomAssetResourceStorePort,
	CustomAssetLibraryPort,
	PinStagingLease,
	PinStagingLeasePort,
	DurablePublicationCandidate,
	NextRevisionPublicationResult,
	ProjectDirectoryPort,
	ProjectDirectoryResult,
	ProjectDeletionPort,
	ProjectSourceRecoveryPort,
	UnverifiedProjectSource,
	ProjectLoadResult,
	PublicationCandidate,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	PublicationResult,
	WriterAccess,
	WriterLeaseControllerPort,
} from "../../application/ports";
import { WRITER_LEASE_DURATION_MS } from "../../application/ports";
import { canonicalProjectSerializer } from "../../application/create-project";
import { isStructurallyValidProjectV1 } from "../../domain/project-json-transfer";
import type { CustomGlbAssetDefinition } from "../../domain/project";
import { encodeRuntimeV1Project } from "../portable-backup/runtime-v1-wire";
import { validateRuntimeV1Project } from "../../application/runtime-v1-project-validation";
import { validateCustomGlbAssetDefinition } from "../../domain/custom-glb-asset";
import type {
	ScopedProjectAccess,
	ScopedProjectStore,
	ScopedWriterRecord,
	ScopedProjectProtocol,
	ScopedProjectRepositoryDependencies,
} from "./scoped-project-protocol";

interface Pointer {
	readonly scope: string;
	readonly projectId: string;
	readonly name: string;
	readonly currentRevisionId: string;
}

interface Attempt {
	readonly protocolVersion: 1;
	readonly scope: string;
	readonly projectId: string;
	readonly attemptId: string;
	readonly leaseId?: string;
	readonly ownerId: string;
	readonly fencingToken: number;
	readonly expectedBaseRevisionId: string | null;
	readonly revisionId: string;
	readonly checksum: string;
	readonly serializedProject: string;
	readonly resourceManifest: readonly {
		readonly resourceHash: string;
		readonly byteLength: number;
	}[];
	readonly intent: "mutation" | "history";
	readonly state: "prepared" | "published" | "no-publish";
	readonly receipt?: {
		readonly revisionId: string;
		readonly checksum: string;
		readonly resourceManifest: Attempt["resourceManifest"];
	};
}

interface PreparedLease extends PinStagingLease {
	readonly scope: string;
	readonly attemptId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly marked: boolean;
}

interface ResourceRow {
	readonly scope: string;
	readonly resourceHash: string;
	readonly byteLength: number;
	readonly blob: Blob;
	readonly version: string;
	readonly creationLeaseId: string;
	readonly roots: readonly string[];
	readonly durable: boolean;
}

interface LibraryRow {
	readonly scope: string;
	readonly resourceHash: string;
	readonly asset: CustomGlbAssetDefinition;
	readonly removed: boolean;
}

interface RevisionRecord {
	readonly scope: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly creationAttemptId: string;
	readonly resourceManifest: Attempt["resourceManifest"];
	readonly candidate: DurablePublicationCandidate;
}

interface CurrentRevisionProof {
	readonly pointer: unknown;
	readonly revision: RevisionRecord;
	readonly creation: Attempt;
}

class WriterLost extends Error {}
class StaleBase extends Error {}

/** Host-neutral fenced protocol; each host supplies its own storage and strict identity rules. */
export class ScopedProjectRepository
	implements
		ProjectRepositoryPort,
		ProjectRevisionPublicationPort,
		ProjectDirectoryPort,
		ProjectDeletionPort,
		ProjectSourceRecoveryPort,
		WriterLeaseControllerPort
{
	private readonly leases = new Map<string, ScopedWriterRecord>();
	private readonly takeoverRequired = new Set<string>();
	private readonly pending = new Map<string, Attempt>();
	private lostWriter = false;
	public readonly pinStaging: PinStagingLeasePort = {
		requiresPublicationContext: true,
		begin: (hashes, context) => this.beginPins(hashes, context),
		markForPublication: (lease, publication) =>
			this.markPins(lease, publication),
		complete: (lease) => this.finishPins(lease, false),
		discard: (lease) => this.finishPins(lease, true),
	};
	public readonly resources: CustomAssetResourceStorePort = {
		read: (hash) => this.readResource(hash),
		writeIfAbsentPinned: (resource, leaseId) =>
			this.writePinnedResource(resource, leaseId),
		writeIfAbsent: async () => {
			throw new Error(
				"Telegram resource admission requires a publication or library root",
			);
		},
		delete: async () => {
			throw new Error("Unconditional Telegram resource deletion is forbidden");
		},
		writeReplacing: (resource) => this.repairResources([resource]),
		writeReplacingBatch: (resources) => this.repairResources(resources),
	};
	public readonly library: CustomAssetLibraryPort = {
		list: () => this.listLibrary(),
		listRemovedResourceHashes: () => this.listRemovedLibrary(),
		register: (asset, resource, options) =>
			this.registerLibrary(asset, resource, options?.restoreRemoved === true),
		remove: (assetId) => this.removeLibrary(assetId),
	};

	private isPreparedLease(
		value: unknown,
		scope: string,
	): value is PreparedLease {
		return isPreparedLease(
			value,
			scope,
			this.protocol.operationIdPrefix(scope, "attempt"),
			this.protocol.operationIdPrefix(scope, "lease"),
		);
	}

	private isAttempt(value: unknown, scope: string): value is Attempt {
		return isAttempt(
			value,
			scope,
			this.protocol.operationIdPrefix(scope, "attempt"),
			this.protocol.operationIdPrefix(scope, "lease"),
		);
	}

	private isResourceRow(value: unknown, scope: string): value is ResourceRow {
		return isResourceRow(
			value,
			scope,
			this.protocol.operationIdPrefix(scope, "lease"),
		);
	}

	private hasResourceOwnership(
		value: unknown,
		scope: string,
	): value is Omit<ResourceRow, "blob" | "byteLength"> & {
		readonly blob: unknown;
		readonly byteLength: unknown;
	} {
		return hasResourceOwnership(
			value,
			scope,
			this.protocol.operationIdPrefix(scope, "lease"),
		);
	}

	public constructor(
		private readonly storage: ScopedProjectStore,
		private readonly dependencies: ScopedProjectRepositoryDependencies,
		private readonly protocol: ScopedProjectProtocol,
	) {
		// Runtime identity is fixed even if the composition's options object changes.
		this.dependencies = { ...dependencies };
		this.protocol = { ...protocol };
	}

	public async publish(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId?: string,
	): Promise<PublicationResult> {
		const result = await this.publishCandidate(
			candidate,
			expectedBaseRevisionId ?? null,
			"mutation",
		);
		return result.kind === "stale-base"
			? { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" }
			: result;
	}

	public publishNextRevision(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId: string,
		intent?: "history",
	): Promise<NextRevisionPublicationResult> {
		return this.publishCandidate(
			candidate,
			expectedBaseRevisionId,
			intent ?? "mutation",
		);
	}

	private async publishCandidate(
		input: DurablePublicationCandidate,
		base: string | null,
		intent: Attempt["intent"],
	): Promise<NextRevisionPublicationResult> {
		let projectId: string | undefined;
		try {
			const candidate = structuredClone(input);
			projectId = candidate.project.projectId;
			if (!(await this.readable(candidate)))
				throw new Error("Invalid publication candidate");
			const manifest = resourceManifest(candidate);
			return await this.storage.run(async (access) => {
				const writer = await this.acquireUnderLock(
					access,
					candidate.project.projectId,
					false,
				);
				if (!writer) throw new WriterLost();
				const key = attemptKey(candidate, base, intent);
				let attempt = this.pending.get(key);
				if (!attempt) {
					attempt = await this.prepareUnderLock(
						access,
						candidate,
						base,
						intent,
						writer,
						manifest,
					);
					this.pending.set(key, attempt);
				}
				const resources = await this.verifyResources(access, manifest);
				await this.commitUnderLock(access, candidate, attempt, resources);
				this.pending.delete(key);
				return { kind: "durable" };
			});
		} catch (error) {
			if (error instanceof WriterLost) {
				this.lostWriter = true;
				if (projectId) {
					this.takeoverRequired.add(projectId);
					try {
						this.dependencies.takeoverRequirements.requireExplicitTakeover(
							projectId,
						);
					} catch {
						/* Remain blocked in this runtime; no further mutation is admitted. */
					}
				}
			}
			if (error instanceof StaleBase) return { kind: "stale-base" };
			return {
				kind: "persist-failed",
				reasonCode:
					record(error) && error.name === "QuotaExceededError"
						? "PERSISTENCE_QUOTA_EXCEEDED"
						: "PERSISTENCE_WRITE_FAILED",
			};
		}
	}

	private async prepareUnderLock(
		access: ScopedProjectAccess,
		candidate: DurablePublicationCandidate,
		base: string | null,
		intent: Attempt["intent"],
		writer: ScopedWriterRecord,
		manifest: Attempt["resourceManifest"],
		lease?: PinStagingLease,
	): Promise<Attempt> {
		const current = await this.verifiedCurrentUnderLock(
			access,
			candidate.project.projectId,
		);
		const attemptId = await access.reserveId("attempt");
		const attempt: Attempt = {
			protocolVersion: 1,
			scope: access.scope,
			projectId: candidate.project.projectId,
			attemptId,
			ownerId: writer.ownerId,
			fencingToken: writer.fencingToken,
			expectedBaseRevisionId: base,
			revisionId: candidate.revision.revisionId,
			checksum: candidate.revision.checksum,
			serializedProject: candidate.revision.serializedProject,
			resourceManifest: manifest,
			intent,
			state: "prepared",
			...(lease ? { leaseId: lease.leaseId } : {}),
		};
		await access.transact(
			[
				"projects",
				"revisions",
				"staging",
				"writer-fences",
				"publication-attempts",
				"pin-staging-leases",
			],
			"readwrite",
			async (transaction) => {
				await this.assertFence(transaction, attempt);
				await this.assertCurrentProof(
					transaction,
					access.scope,
					attempt.projectId,
					current,
				);
				this.assertBase(
					await read(
						transaction.objectStore("projects").get(attempt.projectId),
					),
					attempt,
				);
				const existing: unknown = await read(
					transaction.objectStore("revisions").get(attempt.revisionId),
				);
				if (intent === "history") {
					if (!this.exactRevision(existing, candidate, access.scope))
						throw new Error("History target is not the exact owned Revision");
					if (
						!record(existing) ||
						typeof existing.creationAttemptId !== "string"
					)
						throw new Error("History target has no creation identity");
					const creation: unknown = await read(
						transaction
							.objectStore("publication-attempts")
							.get(existing.creationAttemptId),
					);
					if (
						!record(creation) ||
						creation.protocolVersion !== 1 ||
						creation.scope !== access.scope ||
						creation.projectId !== candidate.project.projectId ||
						creation.attemptId !== existing.creationAttemptId ||
						creation.revisionId !== candidate.revision.revisionId ||
						creation.checksum !== candidate.revision.checksum ||
						creation.serializedProject !==
							candidate.revision.serializedProject ||
						creation.intent !== "mutation" ||
						creation.state !== "published" ||
						!equal(creation.resourceManifest, manifest) ||
						!equal(creation.receipt, {
							revisionId: candidate.revision.revisionId,
							checksum: candidate.revision.checksum,
							resourceManifest: manifest,
						})
					)
						throw new Error("History target was not durably created");
				} else {
					if (existing !== undefined) throw new Error("Revision ID collision");
					if (this.protocol.assertNewRevisionIdentity)
						await this.protocol.assertNewRevisionIdentity(
							transaction,
							candidate,
						);
					transaction.objectStore("revisions").add({
						scope: access.scope,
						projectId: attempt.projectId,
						revisionId: attempt.revisionId,
						creationAttemptId: attemptId,
						resourceManifest: manifest,
						candidate,
					} satisfies RevisionRecord);
				}
				transaction.objectStore("publication-attempts").add(attempt);
				transaction.objectStore("staging").add(stageRecord(attempt, candidate));
				if (lease)
					transaction.objectStore("pin-staging-leases").add({
						...lease,
						scope: access.scope,
						attemptId,
						projectId: attempt.projectId,
						revisionId: attempt.revisionId,
						marked: false,
					} satisfies PreparedLease);
			},
		);
		return attempt;
	}

	private async commitUnderLock(
		access: ScopedProjectAccess,
		candidate: DurablePublicationCandidate,
		attempt: Attempt,
		resources: readonly ResourceRow[],
	): Promise<void> {
		const current = await this.verifiedCurrentUnderLock(
			access,
			attempt.projectId,
		);
		await access.transact(
			[
				"projects",
				"revisions",
				"staging",
				"writer-fences",
				"publication-attempts",
				"resources",
				"pin-staging-leases",
			],
			"readwrite",
			async (transaction) => {
				await this.assertFence(transaction, attempt);
				await this.assertCurrentProof(
					transaction,
					access.scope,
					attempt.projectId,
					current,
				);
				const journal: unknown = await read(
					transaction
						.objectStore("publication-attempts")
						.get(attempt.attemptId),
				);
				if (
					record(journal) &&
					journal.state === "published" &&
					equal(
						{ ...journal, state: "prepared", receipt: undefined },
						{ ...attempt, receipt: undefined },
					)
				) {
					if (
						!equal(journal.receipt, {
							revisionId: attempt.revisionId,
							checksum: attempt.checksum,
							resourceManifest: attempt.resourceManifest,
						})
					)
						throw new Error("Publication receipt is corrupt");
					return;
				}
				if (!equal(journal, attempt))
					throw new Error("Prepared publication is no longer current");
				if (attempt.leaseId) {
					const pins = await this.requirePreparedLease(
						transaction,
						access.scope,
						attempt.leaseId,
					);
					if (!pins.lease.marked || !equal(pins.attempt, attempt))
						throw new Error(
							"Pin lease has not been marked for this publication",
						);
				}
				this.assertBase(
					await read(
						transaction.objectStore("projects").get(attempt.projectId),
					),
					attempt,
				);
				const staged: unknown = await read(
					transaction.objectStore("staging").get(attempt.attemptId),
				);
				if (!equal(staged, stageRecord(attempt, candidate)))
					throw new Error("Exact staging candidate is missing");
				const revision: unknown = await read(
					transaction.objectStore("revisions").get(attempt.revisionId),
				);
				if (!this.exactRevision(revision, candidate, access.scope))
					throw new Error("Immutable Revision changed");
				for (const snapshot of resources) {
					const current: unknown = await read(
						transaction.objectStore("resources").get(snapshot.resourceHash),
					);
					if (
						!this.isResourceRow(current, access.scope) ||
						current.version !== snapshot.version ||
						current.byteLength !== snapshot.byteLength ||
						current.blob.size !== snapshot.blob.size ||
						!equal(current.roots, snapshot.roots) ||
						current.durable !== snapshot.durable ||
						current.creationLeaseId !== snapshot.creationLeaseId
					)
						throw new Error("Verified resource snapshot changed");
					transaction
						.objectStore("resources")
						.put({ ...current, durable: true } satisfies ResourceRow);
				}
				transaction.objectStore("projects").put({
					scope: access.scope,
					projectId: attempt.projectId,
					name: candidate.project.name,
					currentRevisionId: attempt.revisionId,
				} satisfies Pointer);
				transaction.objectStore("publication-attempts").put({
					...attempt,
					state: "published",
					receipt: {
						revisionId: attempt.revisionId,
						checksum: attempt.checksum,
						resourceManifest: attempt.resourceManifest,
					},
				} satisfies Attempt);
				transaction.objectStore("staging").delete(attempt.attemptId);
			},
		);
	}

	private assertBase(
		value: unknown,
		attempt: Pick<Attempt, "scope" | "projectId" | "expectedBaseRevisionId">,
	): void {
		if (value === undefined && attempt.expectedBaseRevisionId === null) return;
		if (
			!record(value) ||
			value.scope !== attempt.scope ||
			value.projectId !== attempt.projectId ||
			value.currentRevisionId !== attempt.expectedBaseRevisionId
		)
			throw new StaleBase();
	}

	private async assertFence(
		transaction: IDBTransaction,
		attempt: Pick<Attempt, "scope" | "projectId" | "ownerId" | "fencingToken">,
	): Promise<void> {
		const writer: unknown = await read(
			transaction.objectStore("writer-fences").get(attempt.projectId),
		);
		const now = this.dependencies.nowEpochMs();
		if (
			!record(writer) ||
			Object.keys(writer).length !== 6 ||
			writer.scope !== attempt.scope ||
			writer.projectId !== attempt.projectId ||
			writer.ownerId !== attempt.ownerId ||
			writer.fencingToken !== attempt.fencingToken ||
			writer.deleted !== false ||
			typeof writer.expiresAtEpochMs !== "number" ||
			!Number.isSafeInteger(writer.expiresAtEpochMs) ||
			!Number.isSafeInteger(now) ||
			now < 0 ||
			writer.expiresAtEpochMs <= now
		)
			throw new WriterLost();
	}

	private async acquireUnderLock(
		access: ScopedProjectAccess,
		projectId: string,
		explicitTakeover: boolean,
	): Promise<ScopedWriterRecord | undefined> {
		if (
			!explicitTakeover &&
			(this.takeoverRequired.has(projectId) ||
				this.dependencies.takeoverRequirements.requiresExplicitTakeover(
					projectId,
				))
		)
			return undefined;
		const current = await this.verifiedCurrentUnderLock(access, projectId);
		const writer = await access.transact(
			[
				"writer-fences",
				"projects",
				"revisions",
				"staging",
				"publication-attempts",
				"pin-staging-leases",
			],
			"readwrite",
			async (transaction) => {
				await this.assertCurrentProof(
					transaction,
					access.scope,
					projectId,
					current,
				);
				const store = transaction.objectStore("writer-fences");
				const raw: unknown = await read(store.get(projectId));
				if (raw === undefined) {
					if (
						this.leases.has(projectId) ||
						(await read(transaction.objectStore("projects").get(projectId))) !==
							undefined
					)
						throw new WriterLost();
					for (const name of [
						"revisions",
						"staging",
						"publication-attempts",
						"pin-staging-leases",
					]) {
						if (
							await containsProjectClaim(
								transaction.objectStore(name),
								projectId,
							)
						)
							throw new WriterLost();
					}
				}
				const decision = this.protocol.decideWriterLease(
					{
						scope: access.scope,
						projectId,
						ownerId: this.dependencies.ownerId,
						nowEpochMs: this.dependencies.nowEpochMs(),
						durationMs: WRITER_LEASE_DURATION_MS,
						explicitTakeover,
					},
					raw,
				);
				const previous = this.leases.get(projectId);
				if (
					!explicitTakeover &&
					previous &&
					record(raw) &&
					(raw.ownerId !== previous.ownerId ||
						raw.fencingToken !== previous.fencingToken)
				)
					return undefined;
				if (decision.kind !== "acquired") return undefined;
				await this.assertProjectJournals(
					transaction,
					access.scope,
					projectId,
					explicitTakeover ? undefined : decision.writer,
				);
				store.put(decision.writer);
				return decision.writer;
			},
		);
		if (writer) {
			this.leases.set(projectId, writer);
		} else {
			this.takeoverRequired.add(projectId);
			this.dependencies.takeoverRequirements.requireExplicitTakeover(projectId);
		}
		return writer;
	}

	private async assertProjectJournals(
		transaction: IDBTransaction,
		scope: string,
		projectId: string,
		writer?: ScopedWriterRecord,
	): Promise<void> {
		const attempts = await projectRecords(
			transaction.objectStore("publication-attempts"),
			projectId,
		);
		const stages = await projectRecords(
			transaction.objectStore("staging"),
			projectId,
		);
		const pins = await projectRecords(
			transaction.objectStore("pin-staging-leases"),
			projectId,
		);
		for (const pin of pins) {
			if (!this.isPreparedLease(pin, scope))
				throw new Error("Unknown Project pin root");
			const attempt = attempts.find(
				(value) =>
					this.isAttempt(value, scope) && value.attemptId === pin.attemptId,
			);
			if (
				!this.isAttempt(attempt, scope) ||
				attempt.state === "no-publish" ||
				attempt.leaseId !== pin.leaseId ||
				attempt.projectId !== projectId ||
				attempt.revisionId !== pin.revisionId ||
				!pin.resourceHashes.every((hash) =>
					attempt.resourceManifest.some((entry) => entry.resourceHash === hash),
				)
			)
				throw new Error("Unresolved Project pin root");
		}
		for (const raw of attempts) {
			if (
				!this.isAttempt(raw, scope) ||
				(raw.state === "published" && !hasReceipt(raw))
			)
				throw new Error("Unknown or incomplete Project journal");
			if (raw.leaseId) {
				// A mismatched Project field must not hide this attempt's actual pin key.
				const pin: unknown = await read(
					transaction.objectStore("pin-staging-leases").get(raw.leaseId),
				);
				if (pin === undefined) {
					if (raw.state === "prepared")
						throw new Error("Prepared Project has lost its pin root");
				} else if (
					!this.isPreparedLease(pin, scope) ||
					pin.attemptId !== raw.attemptId ||
					pin.projectId !== projectId ||
					pin.revisionId !== raw.revisionId ||
					!pin.resourceHashes.every((hash) =>
						raw.resourceManifest.some((entry) => entry.resourceHash === hash),
					) ||
					raw.state === "no-publish" ||
					(raw.state === "published" && !pin.marked)
				) {
					throw new Error("Project journal has an inconsistent pin root");
				}
			}
			if (raw.state === "prepared") {
				if (
					writer &&
					(raw.ownerId !== writer.ownerId ||
						raw.fencingToken !== writer.fencingToken)
				)
					throw new Error("Unresolved publication requires explicit takeover");
				const stage = stages.find(
					(value) => record(value) && value.attemptId === raw.attemptId,
				);
				if (
					!record(stage) ||
					!isV1Candidate(stage.candidate) ||
					stage.candidate.project.projectId !== projectId ||
					stage.candidate.revision.revisionId !== raw.revisionId ||
					stage.candidate.revision.checksum !== raw.checksum ||
					stage.candidate.revision.serializedProject !==
						raw.serializedProject ||
					!equal(stage, stageRecord(raw, stage.candidate))
				)
					throw new Error("Prepared Project staging is incomplete");
				const revision: unknown = await read(
					transaction.objectStore("revisions").get(raw.revisionId),
				);
				if (!this.exactRevision(revision, stage.candidate, scope))
					throw new Error("Prepared Project Revision is incomplete");
				if (raw.intent === "mutation") {
					if (revision.creationAttemptId !== raw.attemptId)
						throw new Error("Prepared Revision has a different creation owner");
				} else {
					const creation: unknown = await read(
						transaction
							.objectStore("publication-attempts")
							.get(revision.creationAttemptId),
					);
					if (
						!this.isAttempt(creation, scope) ||
						creation.attemptId !== revision.creationAttemptId ||
						creation.projectId !== projectId ||
						creation.revisionId !== raw.revisionId ||
						creation.intent !== "mutation" ||
						!hasReceipt(creation) ||
						creation.checksum !== raw.checksum ||
						creation.serializedProject !== raw.serializedProject ||
						!equal(creation.resourceManifest, raw.resourceManifest)
					)
						throw new Error(
							"Prepared history target has no exact creation receipt",
						);
				}
			}
		}
		for (const stage of stages) {
			if (
				!record(stage) ||
				!attempts.some(
					(attempt) =>
						this.isAttempt(attempt, scope) &&
						attempt.state === "prepared" &&
						attempt.attemptId === stage.attemptId,
				)
			)
				throw new Error("Unknown Project staging requires exact recovery");
		}
	}

	public async inspectWriterAccess(projectId: string): Promise<WriterAccess> {
		try {
			const writer = await this.storage.run((access) =>
				this.acquireUnderLock(access, projectId, false),
			);
			return writer
				? { kind: "writable", fencingToken: writer.fencingToken }
				: { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" };
		} catch {
			return { kind: "not-ready" };
		}
	}

	public async takeOverWriterLease(projectId: string): Promise<WriterAccess> {
		try {
			const writer = await this.storage.run(async (access) => {
				const acquired = await this.acquireUnderLock(access, projectId, true);
				if (acquired)
					await this.reconcileProjectUnderLock(access, projectId, acquired);
				return acquired;
			});
			if (!writer) return { kind: "not-ready" };
			this.dependencies.takeoverRequirements.clearExplicitTakeoverRequirement(
				projectId,
			);
			this.takeoverRequired.delete(projectId);
			this.lostWriter = false;
			return { kind: "writable", fencingToken: writer.fencingToken };
		} catch {
			return { kind: "not-ready" };
		}
	}

	public consumeLostWriterLease(): boolean {
		const lost = this.lostWriter;
		this.lostWriter = false;
		return lost;
	}

	/** Explicit takeover adopts only complete journals; every uncertain byte remains rooted. */
	private async reconcileProjectUnderLock(
		access: ScopedProjectAccess,
		projectId: string,
		writer: ScopedWriterRecord,
	): Promise<void> {
		const attempts = await access.transact(
			["publication-attempts"],
			"readonly",
			(transaction) =>
				projectRecords(
					transaction.objectStore("publication-attempts"),
					projectId,
				),
		);
		for (const raw of attempts) {
			if (!this.isAttempt(raw, access.scope))
				throw new Error("Unknown publication journal requires exact recovery");
			const attempt = raw;
			if (attempt.state === "no-publish") continue;
			const snapshot = await access.transact(
				["revisions", "staging", "pin-staging-leases"],
				"readonly",
				async (transaction) => ({
					revision: (await read(
						transaction.objectStore("revisions").get(attempt.revisionId),
					)) as unknown,
					stage: (await read(
						transaction.objectStore("staging").get(attempt.attemptId),
					)) as unknown,
					lease: attempt.leaseId
						? ((await read(
								transaction
									.objectStore("pin-staging-leases")
									.get(attempt.leaseId),
							)) as unknown)
						: undefined,
				}),
			);
			const revision = snapshot.revision;
			if (
				!record(revision) ||
				!isV1Candidate(revision.candidate) ||
				!this.exactRevision(revision, revision.candidate, access.scope) ||
				revision.projectId !== projectId ||
				revision.revisionId !== attempt.revisionId ||
				revision.candidate.revision.checksum !== attempt.checksum ||
				revision.candidate.revision.serializedProject !==
					attempt.serializedProject ||
				!equal(
					resourceManifest(revision.candidate),
					attempt.resourceManifest,
				) ||
				!(await this.readable(revision.candidate))
			)
				throw new Error(
					"Recovery cannot prove the complete immutable candidate",
				);
			if (
				attempt.state === "prepared" &&
				!equal(snapshot.stage, stageRecord(attempt, revision.candidate))
			)
				throw new Error("Prepared staging identity is incomplete");
			if (attempt.state === "published" && !hasReceipt(attempt))
				throw new Error("Recovery requires an exact publication receipt");
			if (
				snapshot.lease !== undefined &&
				(!this.isPreparedLease(snapshot.lease, access.scope) ||
					snapshot.lease.attemptId !== attempt.attemptId ||
					snapshot.lease.leaseId !== attempt.leaseId ||
					snapshot.lease.projectId !== projectId ||
					snapshot.lease.revisionId !== attempt.revisionId)
			)
				throw new Error("Recovery pin lease identity is incomplete");
			if (
				attempt.state === "prepared" &&
				attempt.leaseId &&
				snapshot.lease === undefined
			)
				throw new Error("Unpublished attempt has lost its pin root");
			await access.transact(
				[
					"projects",
					"writer-fences",
					"publication-attempts",
					"revisions",
					"staging",
					"pin-staging-leases",
					"resources",
				],
				"readwrite",
				async (transaction) => {
					await this.assertFence(transaction, writer);
					if (
						!equal(
							await read(
								transaction
									.objectStore("publication-attempts")
									.get(attempt.attemptId),
							),
							attempt,
						) ||
						!equal(
							await read(
								transaction.objectStore("revisions").get(attempt.revisionId),
							),
							snapshot.revision,
						) ||
						!equal(
							await read(
								transaction.objectStore("staging").get(attempt.attemptId),
							),
							snapshot.stage,
						) ||
						(attempt.leaseId &&
							!equal(
								await read(
									transaction
										.objectStore("pin-staging-leases")
										.get(attempt.leaseId),
								),
								snapshot.lease,
							))
					)
						throw new Error("Recovery snapshot changed");
					if (attempt.state === "prepared") {
						const pointer: unknown = await read(
							transaction.objectStore("projects").get(projectId),
						);
						if (
							record(pointer) &&
							pointer.currentRevisionId === attempt.revisionId
						)
							throw new Error(
								"Pointer without its atomic receipt is inconclusive",
							);
						transaction
							.objectStore("publication-attempts")
							.put({ ...attempt, state: "no-publish" } satisfies Attempt);
						transaction.objectStore("staging").delete(attempt.attemptId);
						if (
							attempt.intent === "mutation" &&
							revision.creationAttemptId === attempt.attemptId
						)
							transaction.objectStore("revisions").delete(attempt.revisionId);
					}
					if (this.isPreparedLease(snapshot.lease, access.scope)) {
						for (const hash of snapshot.lease.resourceHashes) {
							const row: unknown = await read(
								transaction.objectStore("resources").get(hash),
							);
							if (row === undefined) continue;
							if (!this.isResourceRow(row, access.scope))
								throw new Error("Recovery cannot prove resource ownership");
							const roots = row.roots.filter(
								(root) => root !== attempt.leaseId,
							);
							if (
								attempt.state === "prepared" &&
								!row.durable &&
								!roots.length &&
								row.creationLeaseId === attempt.leaseId
							)
								transaction.objectStore("resources").delete(hash);
							else {
								if (attempt.state === "published" && !row.durable)
									throw new Error("Receipt has lost its durable resource root");
								transaction
									.objectStore("resources")
									.put({ ...row, roots } satisfies ResourceRow);
							}
						}
						transaction
							.objectStore("pin-staging-leases")
							.delete(snapshot.lease.leaseId);
					}
				},
			);
		}
	}

	private async beginPins(
		hashes: readonly string[],
		context: Parameters<PinStagingLeasePort["begin"]>[1],
	): Promise<PinStagingLease> {
		if (!context)
			throw new Error(
				"Prepared publication identity is required before pinning",
			);
		const candidate = structuredClone(context.candidate);
		if (!(await this.readable(candidate)))
			throw new Error("Invalid pin publication candidate");
		const manifest = resourceManifest(candidate);
		const resourceHashes = [...hashes];
		if (
			!resourceHashes.length ||
			new Set(resourceHashes).size !== resourceHashes.length ||
			resourceHashes.some(
				(hash) => !manifest.some((entry) => entry.resourceHash === hash),
			)
		)
			throw new Error("Pin lease must name unique candidate resources");
		const base = context.expectedBaseRevisionId ?? null;
		return this.storage.run(async (access) => {
			const writer = await this.acquireUnderLock(
				access,
				candidate.project.projectId,
				false,
			);
			if (!writer) throw new WriterLost();
			const key = attemptKey(candidate, base, "mutation");
			if (this.pending.has(key))
				throw new Error("Publication already has a prepared attempt");
			const lease: PinStagingLease = {
				leaseId: await access.reserveId("lease"),
				resourceHashes,
			};
			const attempt = await this.prepareUnderLock(
				access,
				candidate,
				base,
				"mutation",
				writer,
				manifest,
				lease,
			);
			this.pending.set(key, attempt);
			return lease;
		});
	}

	private async requirePreparedLease(
		transaction: IDBTransaction,
		scope: string,
		leaseId: string,
		expected?: PinStagingLease,
	): Promise<{ lease: PreparedLease; attempt: Attempt }> {
		const lease: unknown = await read(
			transaction.objectStore("pin-staging-leases").get(leaseId),
		);
		if (
			!this.isPreparedLease(lease, scope) ||
			(expected &&
				!equal(
					{ leaseId: lease.leaseId, resourceHashes: lease.resourceHashes },
					expected,
				))
		)
			throw new Error("Exact pin lease is missing");
		const attempt: unknown = await read(
			transaction.objectStore("publication-attempts").get(lease.attemptId),
		);
		if (
			!this.isAttempt(attempt, scope) ||
			attempt.leaseId !== leaseId ||
			attempt.intent !== "mutation" ||
			attempt.projectId !== lease.projectId ||
			attempt.revisionId !== lease.revisionId ||
			!lease.resourceHashes.every((hash) =>
				attempt.resourceManifest.some((entry) => entry.resourceHash === hash),
			)
		)
			throw new Error("Pin publication journal is incomplete");
		const owned = this.leases.get(attempt.projectId);
		if (
			attempt.ownerId !== this.dependencies.ownerId ||
			!owned ||
			owned.scope !== scope ||
			owned.ownerId !== attempt.ownerId ||
			owned.fencingToken !== attempt.fencingToken
		)
			throw new WriterLost();
		await this.assertFence(transaction, attempt);
		if (attempt.state === "prepared")
			this.assertBase(
				await read(transaction.objectStore("projects").get(attempt.projectId)),
				attempt,
			);
		return { lease, attempt };
	}

	private async markPins(
		lease: PinStagingLease,
		publication: { readonly projectId: string; readonly revisionId: string },
	): Promise<void> {
		await this.storage.run((access) =>
			access.transact(
				[
					"pin-staging-leases",
					"publication-attempts",
					"writer-fences",
					"projects",
				],
				"readwrite",
				async (transaction) => {
					const current = await this.requirePreparedLease(
						transaction,
						access.scope,
						lease.leaseId,
						lease,
					);
					if (
						current.attempt.state !== "prepared" ||
						current.lease.projectId !== publication.projectId ||
						current.lease.revisionId !== publication.revisionId
					)
						throw new Error("Pin publication identity does not match");
					transaction
						.objectStore("pin-staging-leases")
						.put({ ...current.lease, marked: true } satisfies PreparedLease);
				},
			),
		);
	}

	private async finishPins(
		lease: PinStagingLease,
		discard: boolean,
	): Promise<void> {
		await this.storage.run((access) =>
			access.transact(
				[
					"pin-staging-leases",
					"publication-attempts",
					"writer-fences",
					"projects",
					"staging",
					"revisions",
					"resources",
				],
				"readwrite",
				async (transaction) => {
					if (
						(await read(
							transaction.objectStore("pin-staging-leases").get(lease.leaseId),
						)) === undefined
					)
						return;
					const current = await this.requirePreparedLease(
						transaction,
						access.scope,
						lease.leaseId,
						lease,
					);
					const { attempt } = current;
					if (attempt.state === "published") {
						if (!hasReceipt(attempt))
							throw new Error("Published receipt is incomplete");
					} else if (attempt.state === "prepared" && discard) {
						const staged: unknown = await read(
							transaction.objectStore("staging").get(attempt.attemptId),
						);
						const revision: unknown = await read(
							transaction.objectStore("revisions").get(attempt.revisionId),
						);
						if (
							!record(staged) ||
							!isV1Candidate(staged.candidate) ||
							!equal(staged, stageRecord(attempt, staged.candidate)) ||
							staged.candidate.project.projectId !== attempt.projectId ||
							staged.candidate.revision.revisionId !== attempt.revisionId ||
							!this.exactRevision(revision, staged.candidate, access.scope) ||
							!record(revision) ||
							revision.creationAttemptId !== attempt.attemptId ||
							staged.candidate.revision.checksum !== attempt.checksum ||
							staged.candidate.revision.serializedProject !==
								attempt.serializedProject
						)
							throw new Error("Cancellation cannot prove the complete attempt");
						transaction
							.objectStore("publication-attempts")
							.put({ ...attempt, state: "no-publish" } satisfies Attempt);
						transaction.objectStore("staging").delete(attempt.attemptId);
						transaction.objectStore("revisions").delete(attempt.revisionId);
					} else if (attempt.state !== "no-publish")
						throw new Error("Cannot complete an unpublished pin lease");
					for (const hash of lease.resourceHashes) {
						const row: unknown = await read(
							transaction.objectStore("resources").get(hash),
						);
						if (row === undefined) continue;
						if (!this.isResourceRow(row, access.scope))
							throw new Error("Resource ownership is corrupt");
						const roots = row.roots.filter((root) => root !== lease.leaseId);
						if (
							discard &&
							attempt.state !== "published" &&
							!row.durable &&
							!roots.length &&
							row.creationLeaseId === lease.leaseId
						)
							transaction.objectStore("resources").delete(hash);
						else
							transaction
								.objectStore("resources")
								.put({ ...row, roots } satisfies ResourceRow);
					}
					transaction.objectStore("pin-staging-leases").delete(lease.leaseId);
				},
			),
		);
	}

	private async readResource(hash: string): Promise<Uint8Array | undefined> {
		return this.storage.run(async (access) => {
			const value: unknown = await access.transact(
				["resources"],
				"readonly",
				(transaction) => read(transaction.objectStore("resources").get(hash)),
			);
			if (value === undefined) return undefined;
			if (
				!this.isResourceRow(value, access.scope) ||
				value.resourceHash !== hash
			)
				throw new Error("Resource record is corrupt");
			return new Uint8Array(await value.blob.arrayBuffer());
		});
	}

	private async verifyResource(row: ResourceRow): Promise<void> {
		const bytes = new Uint8Array(await row.blob.arrayBuffer());
		if (
			bytes.byteLength !== row.byteLength ||
			(
				await this.dependencies.binaryChecksum.sha256Bytes(bytes)
			).toLowerCase() !== row.resourceHash.toLowerCase()
		)
			throw new Error("Pinned resource bytes are not exact");
	}

	private async verifyResources(
		access: ScopedProjectAccess,
		manifest: Attempt["resourceManifest"],
	): Promise<readonly ResourceRow[]> {
		const rows = await access.transact(
			["resources"],
			"readonly",
			async (transaction) => {
				const snapshots: ResourceRow[] = [];
				for (const entry of manifest) {
					const row: unknown = await read(
						transaction.objectStore("resources").get(entry.resourceHash),
					);
					if (
						!this.isResourceRow(row, access.scope) ||
						row.resourceHash !== entry.resourceHash ||
						row.byteLength !== entry.byteLength ||
						(!row.durable && row.roots.length === 0)
					)
						throw new Error("Target resource is missing or unrooted");
					snapshots.push(row);
				}
				return snapshots;
			},
		);
		for (const row of rows) await this.verifyResource(row);
		return rows;
	}

	private async writePinnedResource(
		input: CustomAssetResource,
		leaseId: string,
	): Promise<{ readonly kind: "already-present" | "stored" }> {
		const resource = {
			resourceHash: input.resourceHash,
			bytes: input.bytes.slice(),
		};
		if (
			!validHash(resource.resourceHash) ||
			resource.bytes.byteLength === 0 ||
			resource.bytes.byteLength > 50 * 1024 * 1024 ||
			(
				await this.dependencies.binaryChecksum.sha256Bytes(resource.bytes)
			).toLowerCase() !== resource.resourceHash.toLowerCase()
		)
			throw new Error("Invalid resource bytes");
		return this.storage.run(async (access) => {
			const existing: unknown = await access.transact(
				[
					"pin-staging-leases",
					"publication-attempts",
					"writer-fences",
					"projects",
					"resources",
				],
				"readonly",
				async (transaction) => {
					const { lease, attempt } = await this.requirePreparedLease(
						transaction,
						access.scope,
						leaseId,
					);
					if (
						attempt.state !== "prepared" ||
						!lease.resourceHashes.includes(resource.resourceHash) ||
						!attempt.resourceManifest.some(
							(entry) =>
								entry.resourceHash === resource.resourceHash &&
								entry.byteLength === resource.bytes.byteLength,
						)
					)
						throw new Error("Resource is outside its prepared publication");
					return read(
						transaction.objectStore("resources").get(resource.resourceHash),
					);
				},
			);
			if (existing !== undefined) {
				if (
					!this.isResourceRow(existing, access.scope) ||
					existing.resourceHash !== resource.resourceHash ||
					existing.byteLength !== resource.bytes.byteLength
				)
					throw new Error("Existing resource identity is corrupt");
				await this.verifyResource(existing);
			}
			return access.transact(
				[
					"pin-staging-leases",
					"publication-attempts",
					"writer-fences",
					"projects",
					"resources",
				],
				"readwrite",
				async (transaction) => {
					const { lease, attempt } = await this.requirePreparedLease(
						transaction,
						access.scope,
						leaseId,
					);
					if (
						attempt.state !== "prepared" ||
						!lease.resourceHashes.includes(resource.resourceHash)
					)
						throw new Error("Pin lease is closed");
					const store = transaction.objectStore("resources");
					const current: unknown = await read(store.get(resource.resourceHash));
					if (existing === undefined) {
						if (current !== undefined)
							throw new Error("Resource changed before pinning");
						store.add({
							scope: access.scope,
							resourceHash: resource.resourceHash,
							byteLength: resource.bytes.byteLength,
							blob: new Blob([Uint8Array.from(resource.bytes).buffer]),
							version: leaseId,
							creationLeaseId: leaseId,
							roots: [leaseId],
							durable: false,
						} satisfies ResourceRow);
						return { kind: "stored" };
					}
					if (
						!this.isResourceRow(existing, access.scope) ||
						!this.isResourceRow(current, access.scope) ||
						current.version !== existing.version ||
						current.byteLength !== existing.byteLength ||
						!equal(current.roots, existing.roots) ||
						current.durable !== existing.durable ||
						current.creationLeaseId !== existing.creationLeaseId
					)
						throw new Error("Verified resource changed before protection");
					store.put({
						...current,
						roots: [...new Set([...current.roots, leaseId])],
					} satisfies ResourceRow);
					return { kind: "already-present" };
				},
			);
		});
	}

	private async listLibraryRows(): Promise<readonly LibraryRow[]> {
		return this.storage.run((access) =>
			access.transact(["library"], "readonly", async (transaction) => {
				const rows: unknown[] = await read(
					transaction.objectStore("library").getAll(),
				);
				if (
					!rows.every((row): row is LibraryRow =>
						isLibraryRow(row, access.scope),
					)
				)
					throw new Error("Local library metadata is corrupt");
				return rows;
			}),
		);
	}

	private async listLibrary(): Promise<readonly CustomGlbAssetDefinition[]> {
		return (await this.listLibraryRows())
			.filter((row) => !row.removed)
			.map((row) => structuredClone(row.asset))
			.sort(
				(left, right) =>
					left.displayName.localeCompare(right.displayName) ||
					left.assetDefinitionId.localeCompare(right.assetDefinitionId),
			);
	}

	private async listRemovedLibrary(): Promise<readonly string[]> {
		return (await this.listLibraryRows())
			.filter((row) => row.removed)
			.map((row) => row.resourceHash);
	}

	private async removeLibrary(
		assetId: string,
	): Promise<{ readonly kind: "removed" | "not-found" }> {
		return this.storage.run((access) =>
			access.transact(["library"], "readwrite", async (transaction) => {
				const rows: unknown[] = await read(
					transaction.objectStore("library").getAll(),
				);
				if (
					!rows.every((row): row is LibraryRow =>
						isLibraryRow(row, access.scope),
					)
				)
					throw new Error("Local library ownership is corrupt");
				const row = rows.find((row) => row.asset.assetDefinitionId === assetId);
				if (!row || row.removed) return { kind: "not-found" };
				transaction
					.objectStore("library")
					.put({ ...row, removed: true } satisfies LibraryRow);
				return { kind: "removed" };
			}),
		);
	}

	private async registerLibrary(
		input: CustomGlbAssetDefinition,
		inputResource: CustomAssetResource,
		restore: boolean,
	): ReturnType<CustomAssetLibraryPort["register"]> {
		const asset = structuredClone(input);
		const resource = {
			resourceHash: inputResource.resourceHash,
			bytes: inputResource.bytes.slice(),
		};
		if (
			validateCustomGlbAssetDefinition(asset).kind !== "accepted" ||
			asset.resourceHash !== resource.resourceHash ||
			asset.byteLength !== resource.bytes.byteLength ||
			resource.bytes.byteLength > 50 * 1024 * 1024 ||
			(
				await this.dependencies.binaryChecksum.sha256Bytes(resource.bytes)
			).toLowerCase() !== resource.resourceHash.toLowerCase()
		)
			throw new Error("Local library resource is not exact");
		return this.storage.run(async (access) => {
			const version = await access.reserveId("lease");
			const snapshot: unknown = await access.transact(
				["resources"],
				"readonly",
				(transaction) =>
					read(transaction.objectStore("resources").get(resource.resourceHash)),
			);
			if (snapshot !== undefined) {
				if (
					!this.isResourceRow(snapshot, access.scope) ||
					snapshot.resourceHash !== resource.resourceHash ||
					snapshot.byteLength !== resource.bytes.byteLength
				)
					throw new Error("Existing library resource is corrupt");
				await this.verifyResource(snapshot);
			}
			return access.transact(
				["resources", "library"],
				"readwrite",
				async (transaction) => {
					const rows: unknown[] = await read(
						transaction.objectStore("library").getAll(),
					);
					if (
						!rows.every((row): row is LibraryRow =>
							isLibraryRow(row, access.scope),
						)
					)
						throw new Error("Library contains unknown ownership");
					const existing = rows.find(
						(row) => row.resourceHash === resource.resourceHash,
					);
					if (
						rows.some(
							(row) =>
								row.asset.assetDefinitionId === asset.assetDefinitionId &&
								row.resourceHash !== resource.resourceHash,
						)
					)
						throw new Error("Library asset identity collision");
					if (existing?.removed && !restore)
						return {
							kind: "suppressed",
							asset: structuredClone(existing.asset),
						};
					const current: unknown = await read(
						transaction.objectStore("resources").get(resource.resourceHash),
					);
					if (snapshot === undefined) {
						if (current !== undefined)
							throw new Error("Library resource appeared after verification");
						transaction.objectStore("resources").add({
							scope: access.scope,
							resourceHash: resource.resourceHash,
							byteLength: resource.bytes.byteLength,
							blob: new Blob([Uint8Array.from(resource.bytes).buffer]),
							version,
							creationLeaseId: version,
							roots: [],
							durable: true,
						} satisfies ResourceRow);
					} else {
						if (
							!this.isResourceRow(snapshot, access.scope) ||
							!this.isResourceRow(current, access.scope) ||
							!sameResourceSnapshot(current, snapshot)
						)
							throw new Error("Verified library resource changed");
						transaction
							.objectStore("resources")
							.put({ ...current, durable: true } satisfies ResourceRow);
					}
					const chosen = existing?.asset ?? asset;
					transaction.objectStore("library").put({
						scope: access.scope,
						resourceHash: resource.resourceHash,
						asset: chosen,
						removed: false,
					} satisfies LibraryRow);
					return {
						kind:
							existing && !existing.removed ? "already-present" : "registered",
						asset: structuredClone(chosen),
					};
				},
			);
		});
	}

	/** Exact bytes repair already-published roots; no semantic Revision is created. */
	private async repairResources(
		input: readonly CustomAssetResource[],
	): Promise<void> {
		const roots = structuredClone(this.dependencies.sessionRoots?.());
		if (!roots?.current || input.length === 0)
			throw new Error("Repair requires captured current and history roots");
		const current = roots.current;
		const candidates = [current, ...roots.undo, ...roots.redo];
		const manifest = new Map<string, number>();
		for (const candidate of candidates) {
			if (
				candidate.project.projectId !== current.project.projectId ||
				!(await this.readable(candidate))
			)
				throw new Error("Repair root identity is invalid");
			for (const entry of resourceManifest(candidate)) {
				if (
					manifest.has(entry.resourceHash) &&
					manifest.get(entry.resourceHash) !== entry.byteLength
				)
					throw new Error("Repair roots disagree on immutable bytes");
				manifest.set(entry.resourceHash, entry.byteLength);
			}
		}
		const resources = input.map((resource) => ({
			resourceHash: resource.resourceHash,
			bytes: resource.bytes.slice(),
		}));
		if (
			new Set(resources.map((resource) => resource.resourceHash)).size !==
			resources.length
		)
			throw new Error("Repair hashes must be unique");
		for (const resource of resources) {
			if (
				manifest.get(resource.resourceHash) !== resource.bytes.byteLength ||
				(
					await this.dependencies.binaryChecksum.sha256Bytes(resource.bytes)
				).toLowerCase() !== resource.resourceHash.toLowerCase()
			)
				throw new Error("Repair contains unreferenced or inexact bytes");
		}
		await this.storage.run(async (access) => {
			const writer = await this.acquireUnderLock(
				access,
				current.project.projectId,
				false,
			);
			if (!writer) throw new WriterLost();
			const version = await access.reserveId("lease");
			if (!equal(this.dependencies.sessionRoots?.(), roots))
				throw new Error("Session roots changed during repair verification");
			await access.transact(
				[
					"projects",
					"writer-fences",
					"revisions",
					"publication-attempts",
					"resources",
				],
				"readwrite",
				async (transaction) => {
					await this.assertFence(transaction, writer);
					this.assertBase(
						await read(
							transaction
								.objectStore("projects")
								.get(current.project.projectId),
						),
						{
							scope: access.scope,
							projectId: current.project.projectId,
							expectedBaseRevisionId: current.revision.revisionId,
						},
					);
					for (const candidate of candidates) {
						const revision: unknown = await read(
							transaction
								.objectStore("revisions")
								.get(candidate.revision.revisionId),
						);
						if (
							!record(revision) ||
							!this.exactRevision(revision, candidate, access.scope) ||
							typeof revision.creationAttemptId !== "string"
						)
							throw new Error("Repair root is not the exact owned Revision");
						const creation: unknown = await read(
							transaction
								.objectStore("publication-attempts")
								.get(revision.creationAttemptId),
						);
						if (
							!this.isAttempt(creation, access.scope) ||
							creation.projectId !== current.project.projectId ||
							creation.attemptId !== revision.creationAttemptId ||
							creation.revisionId !== candidate.revision.revisionId ||
							creation.checksum !== candidate.revision.checksum ||
							creation.serializedProject !==
								candidate.revision.serializedProject ||
							!equal(creation.resourceManifest, resourceManifest(candidate)) ||
							!hasReceipt(creation)
						)
							throw new Error("Repair root has no exact durable receipt");
					}
					for (const resource of resources) {
						const row: unknown = await read(
							transaction.objectStore("resources").get(resource.resourceHash),
						);
						if (
							row !== undefined &&
							(!this.hasResourceOwnership(row, access.scope) ||
								row.resourceHash !== resource.resourceHash)
						)
							throw new Error(
								"Cannot safely repair unknown resource ownership",
							);
						transaction.objectStore("resources").put({
							scope: access.scope,
							resourceHash: resource.resourceHash,
							byteLength: resource.bytes.byteLength,
							blob: new Blob([Uint8Array.from(resource.bytes).buffer]),
							version,
							creationLeaseId: this.hasResourceOwnership(row, access.scope)
								? row.creationLeaseId
								: version,
							roots: this.hasResourceOwnership(row, access.scope)
								? row.roots
								: [],
							durable: true,
						} satisfies ResourceRow);
					}
				},
			);
		});
	}

	/** Hash outside a native transaction; recheck its complete ownership proof in the writing transaction. */
	private async verifiedCurrentUnderLock(
		access: ScopedProjectAccess,
		projectId: string,
	): Promise<CurrentRevisionProof | undefined> {
		const proof = await access.transact(
			["projects", "revisions", "publication-attempts"],
			"readonly",
			(transaction) =>
				this.readCurrentProof(transaction, access.scope, projectId),
		);
		if (proof && !(await this.readable(proof.revision.candidate)))
			throw new Error("Current Project is unreadable");
		return proof;
	}

	private async readCurrentProof(
		transaction: IDBTransaction,
		scope: string,
		projectId: string,
	): Promise<CurrentRevisionProof | undefined> {
		const pointer: unknown = await read(
			transaction.objectStore("projects").get(projectId),
		);
		if (pointer === undefined) return undefined;
		if (
			!record(pointer) ||
			Object.keys(pointer).length !== 4 ||
			pointer.scope !== scope ||
			pointer.projectId !== projectId ||
			typeof pointer.currentRevisionId !== "string"
		)
			throw new Error("Project pointer is corrupt");
		const revision: unknown = await read(
			transaction.objectStore("revisions").get(pointer.currentRevisionId),
		);
		if (
			!record(revision) ||
			!isV1Candidate(revision.candidate) ||
			revision.candidate.project.projectId !== projectId ||
			revision.candidate.revision.revisionId !== pointer.currentRevisionId ||
			pointer.name !== revision.candidate.project.name ||
			!this.exactRevision(revision, revision.candidate, scope)
		)
			throw new Error("Current Project Revision has no exact ownership");
		const creation: unknown = await read(
			transaction
				.objectStore("publication-attempts")
				.get(revision.creationAttemptId),
		);
		if (
			!this.isAttempt(creation, scope) ||
			creation.attemptId !== revision.creationAttemptId ||
			creation.projectId !== projectId ||
			creation.revisionId !== pointer.currentRevisionId ||
			creation.intent !== "mutation" ||
			!hasReceipt(creation) ||
			creation.checksum !== revision.candidate.revision.checksum ||
			creation.serializedProject !==
				revision.candidate.revision.serializedProject ||
			!equal(creation.resourceManifest, revision.resourceManifest)
		)
			throw new Error(
				"Current Project has no exact published creation receipt",
			);
		return { pointer, revision, creation };
	}

	private async assertCurrentProof(
		transaction: IDBTransaction,
		scope: string,
		projectId: string,
		expected: CurrentRevisionProof | undefined,
	): Promise<void> {
		if (
			!equal(
				await this.readCurrentProof(transaction, scope, projectId),
				expected,
			)
		)
			throw new Error("Verified current Project changed");
	}

	public async loadProject(projectId: string): Promise<ProjectLoadResult> {
		try {
			return await this.storage.run(async (access) => {
				const proof = await this.verifiedCurrentUnderLock(access, projectId);
				return proof
					? { kind: "durable", candidate: proof.revision.candidate }
					: { kind: "empty" };
			});
		} catch {
			return { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
		}
	}

	public async listProjects(): Promise<ProjectDirectoryResult> {
		try {
			const ids = await this.storage.run((access) =>
				access.transact(["projects"], "readonly", async (transaction) =>
					read(transaction.objectStore("projects").getAllKeys()),
				),
			);
			const projects = [];
			let recoveryNeeded = false;
			for (const id of ids) {
				if (typeof id !== "string") {
					recoveryNeeded = true;
					continue;
				}
				const loaded = await this.loadProject(id);
				if (loaded.kind !== "durable") {
					recoveryNeeded = true;
					continue;
				}
				projects.push({
					projectId: id,
					revisionId: loaded.candidate.revision.revisionId,
					name: loaded.candidate.project.name,
					updatedAt: loaded.candidate.project.updatedAt,
				});
			}
			projects.sort(
				(left, right) =>
					right.updatedAt.localeCompare(left.updatedAt) ||
					left.projectId.localeCompare(right.projectId),
			);
			return projects.length
				? {
						kind: "populated",
						projects,
						...(recoveryNeeded ? { recoveryNeeded: true as const } : {}),
					}
				: recoveryNeeded
					? { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" }
					: { kind: "empty" };
		} catch {
			return { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
		}
	}

	public async listRecoverySources(): ReturnType<
		ProjectSourceRecoveryPort["listRecoverySources"]
	> {
		const ids = await this.storage.run((access) =>
			access.transact(["projects"], "readonly", (transaction) =>
				read(transaction.objectStore("projects").getAllKeys()),
			),
		);
		const sources: Omit<UnverifiedProjectSource, "serializedProject">[] = [];
		for (const id of ids) {
			if (typeof id !== "string") continue;
			const row = await this.storage.run((access) =>
				this.readRecoveryRow(access, id),
			);
			if (!row) continue;
			let healthy = false;
			try {
				healthy = !!(await this.storage.run((access) =>
					this.verifiedCurrentUnderLock(access, id),
				));
			} catch {
				/* A failed proof stays separate from the read-only source query. */
			}
			if (!healthy)
				sources.push({
					kind: "unverified-source",
					projectId: id,
					revisionId: row.revisionId,
				});
		}
		return sources;
	}

	public readRecoverySource(
		projectId: string,
		expectedRevisionId: string,
	): ReturnType<ProjectSourceRecoveryPort["readRecoverySource"]> {
		return this.storage.run(async (access) => {
			const row = await this.readRecoveryRow(access, projectId);
			if (!row || row.revisionId !== expectedRevisionId) return undefined;
			return {
				kind: "unverified-source",
				projectId,
				revisionId: row.revisionId,
				serializedProject: row.serializedProject,
			};
		});
	}

	private readRecoveryRow(
		access: ScopedProjectAccess,
		projectId: string,
	): Promise<
		| {
				readonly revisionId: string;
				readonly serializedProject: string;
				readonly candidate: unknown;
		  }
		| undefined
	> {
		return access.transact(
			["projects", "revisions"],
			"readonly",
			async (transaction) => {
				const pointer: unknown = await read(
					transaction.objectStore("projects").get(projectId),
				);
				if (
					!record(pointer) ||
					pointer.scope !== access.scope ||
					pointer.projectId !== projectId ||
					typeof pointer.currentRevisionId !== "string"
				)
					return undefined;
				const row: unknown = await read(
					transaction.objectStore("revisions").get(pointer.currentRevisionId),
				);
				if (
					!record(row) ||
					row.scope !== access.scope ||
					row.projectId !== projectId ||
					row.revisionId !== pointer.currentRevisionId ||
					!record(row.candidate) ||
					!record(row.candidate.project) ||
					row.candidate.project.projectId !== projectId ||
					!record(row.candidate.revision) ||
					row.candidate.revision.projectId !== projectId ||
					row.candidate.revision.revisionId !== pointer.currentRevisionId ||
					typeof row.candidate.revision.serializedProject !== "string"
				)
					return undefined;
				return {
					revisionId: pointer.currentRevisionId,
					serializedProject: row.candidate.revision.serializedProject,
					candidate: row.candidate,
				};
			},
		);
	}

	public async loadCurrent(): Promise<ProjectLoadResult> {
		const directory = await this.listProjects();
		return directory.kind === "empty"
			? { kind: "empty" }
			: directory.kind === "populated" && directory.projects.length === 1
				? this.loadProject(directory.projects[0].projectId)
				: { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
	}

	public async recover(): Promise<{ readonly kind: "recovered" }> {
		// Opening validates the scope schema/identity. Pending records are never
		// deleted at startup; per-Project admission quarantines uncertain state.
		await this.storage.run((access) =>
			access.transact(["staging"], "readonly", (transaction) =>
				read(transaction.objectStore("staging").count()),
			),
		);
		return { kind: "recovered" };
	}

	public async permanentlyDeleteProject(
		projectId: string,
	): ReturnType<ProjectDeletionPort["permanentlyDeleteProject"]> {
		try {
			return await this.storage.run(async (access) => {
				const pointer = await access.transact(
					["projects"],
					"readonly",
					(transaction) =>
						read(
							transaction.objectStore("projects").get(projectId),
						) as Promise<unknown>,
				);
				if (pointer === undefined) return { kind: "not-found" };
				const writer = await this.acquireUnderLock(access, projectId, false);
				if (!writer) throw new WriterLost();
				await this.reconcileProjectUnderLock(access, projectId, writer);
				await access.transact(
					[
						"projects",
						"writer-fences",
						"revisions",
						"staging",
						"publication-attempts",
						"pin-staging-leases",
					],
					"readwrite",
					async (transaction) => {
						await this.assertFence(transaction, writer);
						if (
							!equal(
								await read(transaction.objectStore("projects").get(projectId)),
								pointer,
							)
						)
							throw new StaleBase();
						await this.assertProjectJournals(
							transaction,
							access.scope,
							projectId,
							writer,
						);
						const revisions = await projectRecords(
							transaction.objectStore("revisions"),
							projectId,
						);
						for (const revision of revisions) {
							if (
								!record(revision) ||
								revision.scope !== access.scope ||
								typeof revision.revisionId !== "string"
							)
								throw new Error("Cannot prove Revision deletion ownership");
							transaction.objectStore("revisions").delete(revision.revisionId);
						}
						transaction.objectStore("projects").delete(projectId);
						transaction.objectStore("writer-fences").put({
							...writer,
							deleted: true,
							expiresAtEpochMs: 0,
						} satisfies ScopedWriterRecord);
					},
				);
				return { kind: "permanently-deleted" };
			});
		} catch {
			return { kind: "persist-failed" };
		}
	}

	private exactRevision(
		value: unknown,
		candidate: DurablePublicationCandidate,
		scope: string,
	): value is RevisionRecord {
		return (
			record(value) &&
			Object.keys(value).length === 6 &&
			value.scope === scope &&
			value.projectId === candidate.project.projectId &&
			value.revisionId === candidate.revision.revisionId &&
			typeof value.creationAttemptId === "string" &&
			equal(value.resourceManifest, resourceManifest(candidate)) &&
			equal(value.candidate, candidate)
		);
	}

	private async readable(candidate: unknown): Promise<boolean> {
		try {
			return (
				isV1Candidate(candidate) &&
				candidate.project.schemaVersion === 1 &&
				candidate.revision.schemaVersion === 1 &&
				isStructurallyValidProjectV1(candidate.project) &&
				encodeRuntimeV1Project(candidate.project).kind === "encoded" &&
				validateRuntimeV1Project(candidate.project).kind === "accepted" &&
				candidate.revision.projectId === candidate.project.projectId &&
				typeof candidate.revision.revisionId === "string" &&
				candidate.revision.revisionId.length > 0 &&
				canonicalProjectSerializer.serialize(candidate.project) ===
					candidate.revision.serializedProject &&
				(await this.dependencies.checksum.sha256(
					candidate.revision.serializedProject,
				)) === candidate.revision.checksum
			);
		} catch {
			return false;
		}
	}
}

function record(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function projectRecords(
	store: IDBObjectStore,
	projectId: string,
): Promise<readonly unknown[]> {
	return new Promise((resolve, reject) => {
		const rows: unknown[] = [];
		const request = store.openCursor();
		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) {
				resolve(rows);
				return;
			}
			const value: unknown = cursor.value;
			if (!record(value) || typeof value.projectId !== "string") {
				reject(new Error("Journal has unknown Project ownership"));
				return;
			}
			if (value.projectId === projectId) rows.push(value);
			cursor.continue();
		};
	});
}

function isV1Candidate(value: unknown): value is PublicationCandidate {
	return (
		record(value) &&
		isStructurallyValidProjectV1(value.project) &&
		record(value.revision) &&
		value.revision.schemaVersion === 1 &&
		typeof value.revision.projectId === "string" &&
		typeof value.revision.revisionId === "string" &&
		value.revision.revisionId.length > 0 &&
		typeof value.revision.createdAt === "string" &&
		typeof value.revision.serializedProject === "string" &&
		typeof value.revision.checksum === "string"
	);
}

function attemptKey(
	candidate: DurablePublicationCandidate,
	base: string | null,
	intent: Attempt["intent"],
): string {
	return JSON.stringify([
		candidate.project.projectId,
		candidate.revision.revisionId,
		base,
		intent,
	]);
}

function stageRecord(attempt: Attempt, candidate: DurablePublicationCandidate) {
	return {
		protocolVersion: 1,
		scope: attempt.scope,
		projectId: attempt.projectId,
		attemptId: attempt.attemptId,
		ownerId: attempt.ownerId,
		fencingToken: attempt.fencingToken,
		expectedBaseRevisionId: attempt.expectedBaseRevisionId,
		revisionId: attempt.revisionId,
		checksum: attempt.checksum,
		resourceManifest: attempt.resourceManifest,
		candidate,
	};
}

function validHash(value: unknown): value is string {
	return typeof value === "string" && /^[a-fA-F0-9]{64}$/.test(value);
}

function resourceManifest(
	candidate: DurablePublicationCandidate,
): Attempt["resourceManifest"] {
	const resources = new Map<string, number>();
	for (const definition of candidate.project.assetDefinitionRefs) {
		if (
			!validHash(definition.resourceHash) ||
			!Number.isSafeInteger(definition.byteLength) ||
			definition.byteLength <= 0 ||
			definition.byteLength > 50 * 1024 * 1024 ||
			(resources.has(definition.resourceHash) &&
				resources.get(definition.resourceHash) !== definition.byteLength)
		)
			throw new Error("Invalid target resource manifest");
		resources.set(definition.resourceHash, definition.byteLength);
	}
	if (
		resources.size > 900 ||
		[...resources.values()].reduce((sum, length) => sum + length, 0) >
			180 * 1024 * 1024
	)
		throw new Error("Target resource envelope exceeded");
	return [...resources]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([resourceHash, byteLength]) => ({ resourceHash, byteLength }));
}

/** Native metadata arrays must own every index; iteration methods skip sparse holes. */
function denseArray(value: unknown): value is readonly unknown[] {
	if (!Array.isArray(value)) return false;
	const keys = Object.keys(value);
	return (
		keys.length === value.length &&
		keys.every((key, index) => key === String(index))
	);
}

function isPreparedLease(
	value: unknown,
	scope: string,
	attemptIdPrefix: string,
	leaseIdPrefix: string,
): value is PreparedLease {
	return (
		record(value) &&
		Object.keys(value).length === 7 &&
		value.scope === scope &&
		typeof value.leaseId === "string" &&
		value.leaseId.startsWith(leaseIdPrefix) &&
		typeof value.attemptId === "string" &&
		value.attemptId.startsWith(attemptIdPrefix) &&
		typeof value.projectId === "string" &&
		typeof value.revisionId === "string" &&
		typeof value.marked === "boolean" &&
		denseArray(value.resourceHashes) &&
		value.resourceHashes.length > 0 &&
		value.resourceHashes.every(validHash) &&
		new Set(value.resourceHashes).size === value.resourceHashes.length
	);
}

function isAttempt(
	value: unknown,
	scope: string,
	attemptIdPrefix: string,
	leaseIdPrefix: string,
): value is Attempt {
	const required = [
		"protocolVersion",
		"scope",
		"projectId",
		"attemptId",
		"ownerId",
		"fencingToken",
		"expectedBaseRevisionId",
		"revisionId",
		"checksum",
		"serializedProject",
		"resourceManifest",
		"intent",
		"state",
	];
	const allowed = new Set([...required, "leaseId", "receipt"]);
	return (
		record(value) &&
		required.every((key) => Object.hasOwn(value, key)) &&
		Object.keys(value).every((key) => allowed.has(key)) &&
		value.protocolVersion === 1 &&
		value.scope === scope &&
		typeof value.projectId === "string" &&
		typeof value.attemptId === "string" &&
		value.attemptId.startsWith(attemptIdPrefix) &&
		typeof value.ownerId === "string" &&
		typeof value.fencingToken === "number" &&
		Number.isSafeInteger(value.fencingToken) &&
		value.fencingToken > 0 &&
		(value.expectedBaseRevisionId === null ||
			typeof value.expectedBaseRevisionId === "string") &&
		typeof value.revisionId === "string" &&
		typeof value.checksum === "string" &&
		typeof value.serializedProject === "string" &&
		denseArray(value.resourceManifest) &&
		value.resourceManifest.every(
			(entry: unknown) =>
				record(entry) &&
				Object.keys(entry).length === 2 &&
				validHash(entry.resourceHash) &&
				typeof entry.byteLength === "number" &&
				Number.isSafeInteger(entry.byteLength) &&
				entry.byteLength > 0 &&
				entry.byteLength <= 50 * 1024 * 1024,
		) &&
		(value.intent === "mutation" || value.intent === "history") &&
		(value.state === "prepared" ||
			value.state === "published" ||
			value.state === "no-publish") &&
		(!Object.hasOwn(value, "leaseId") ||
			(typeof value.leaseId === "string" &&
				value.leaseId.startsWith(leaseIdPrefix))) &&
		(value.state === "published"
			? Object.hasOwn(value, "receipt")
			: !Object.hasOwn(value, "receipt"))
	);
}

function hasReceipt(attempt: Attempt): boolean {
	return (
		attempt.state === "published" &&
		equal(attempt.receipt, {
			revisionId: attempt.revisionId,
			checksum: attempt.checksum,
			resourceManifest: attempt.resourceManifest,
		})
	);
}

function isResourceRow(
	value: unknown,
	scope: string,
	leaseIdPrefix: string,
): value is ResourceRow {
	return (
		hasResourceOwnership(value, scope, leaseIdPrefix) &&
		typeof value.byteLength === "number" &&
		Number.isSafeInteger(value.byteLength) &&
		value.byteLength > 0 &&
		value.byteLength <= 50 * 1024 * 1024 &&
		value.blob instanceof Blob &&
		value.blob.size === value.byteLength
	);
}

function hasResourceOwnership(
	value: unknown,
	scope: string,
	leaseIdPrefix: string,
): value is Omit<ResourceRow, "blob" | "byteLength"> & {
	readonly blob: unknown;
	readonly byteLength: unknown;
} {
	return (
		record(value) &&
		Object.keys(value).length === 8 &&
		value.scope === scope &&
		validHash(value.resourceHash) &&
		typeof value.version === "string" &&
		value.version.startsWith(leaseIdPrefix) &&
		typeof value.creationLeaseId === "string" &&
		value.creationLeaseId.startsWith(leaseIdPrefix) &&
		denseArray(value.roots) &&
		value.roots.every(
			(root) => typeof root === "string" && root.startsWith(leaseIdPrefix),
		) &&
		new Set(value.roots).size === value.roots.length &&
		typeof value.durable === "boolean"
	);
}

function sameResourceSnapshot(
	current: ResourceRow,
	snapshot: ResourceRow,
): boolean {
	return (
		current.scope === snapshot.scope &&
		current.resourceHash === snapshot.resourceHash &&
		current.version === snapshot.version &&
		current.byteLength === snapshot.byteLength &&
		current.blob.size === snapshot.blob.size &&
		current.creationLeaseId === snapshot.creationLeaseId &&
		current.durable === snapshot.durable &&
		equal(current.roots, snapshot.roots)
	);
}

function isLibraryRow(value: unknown, scope: string): value is LibraryRow {
	if (
		!record(value) ||
		Object.keys(value).length !== 4 ||
		value.scope !== scope ||
		!validHash(value.resourceHash) ||
		typeof value.removed !== "boolean" ||
		!record(value.asset)
	)
		return false;
	const asset = value.asset;
	const keys = new Set([
		"assetDefinitionId",
		"byteLength",
		"depthMm",
		"displayName",
		"format",
		"heightMm",
		"resourceHash",
		"widthMm",
		"source",
		"catalogAssetId",
		"catalogVersion",
		"catalogEnvelopeHash",
	]);
	if (
		Object.keys(asset).some((key) => !keys.has(key)) ||
		asset.format !== "glb" ||
		asset.resourceHash !== value.resourceHash ||
		typeof asset.assetDefinitionId !== "string" ||
		!asset.assetDefinitionId.trim() ||
		typeof asset.displayName !== "string" ||
		!asset.displayName.trim() ||
		asset.displayName.trim() !== asset.displayName ||
		typeof asset.byteLength !== "number" ||
		!Number.isSafeInteger(asset.byteLength) ||
		asset.byteLength <= 0 ||
		asset.byteLength > 50 * 1024 * 1024
	)
		return false;
	for (const dimension of [asset.widthMm, asset.heightMm, asset.depthMm])
		if (
			typeof dimension !== "number" ||
			!Number.isSafeInteger(dimension) ||
			dimension <= 0 ||
			dimension > 100000
		)
			return false;
	const provenance = [
		asset.source,
		asset.catalogAssetId,
		asset.catalogVersion,
		asset.catalogEnvelopeHash,
	];
	return (
		provenance.every((entry) => entry === undefined) ||
		(asset.source === "CatalogVersion" &&
			typeof asset.catalogAssetId === "string" &&
			!!asset.catalogAssetId.trim() &&
			asset.catalogAssetId.trim() === asset.catalogAssetId &&
			typeof asset.catalogVersion === "string" &&
			!!asset.catalogVersion.trim() &&
			asset.catalogVersion.trim() === asset.catalogVersion &&
			validHash(asset.catalogEnvelopeHash))
	);
}

/** Never materialize all historical Project payloads just to prove a fresh ID. */
function containsProjectClaim(
	store: IDBObjectStore,
	projectId: string,
): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const request = store.openCursor();
		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const cursor = request.result;
			if (!cursor) {
				resolve(false);
				return;
			}
			const value: unknown = cursor.value;
			if (!record(value)) {
				reject(new Error("Cannot prove a fresh Project ID"));
				return;
			}
			const candidate = record(value.candidate) ? value.candidate : undefined;
			const project =
				candidate && record(candidate.project) ? candidate.project : undefined;
			const revision =
				candidate && record(candidate.revision)
					? candidate.revision
					: undefined;
			if (
				value.projectId === projectId ||
				project?.projectId === projectId ||
				revision?.projectId === projectId
			) {
				resolve(true);
				return;
			}
			if (
				typeof value.projectId !== "string" &&
				typeof project?.projectId !== "string"
			) {
				reject(new Error("Unknown Project ownership record"));
				return;
			}
			cursor.continue();
		};
	});
}

function equal(left: unknown, right: unknown, depth = 0): boolean {
	if (Object.is(left, right)) return true;
	if (
		depth > 128 ||
		!left ||
		!right ||
		typeof left !== "object" ||
		typeof right !== "object" ||
		Array.isArray(left) !== Array.isArray(right)
	)
		return false;
	if (
		Array.isArray(left) &&
		Array.isArray(right) &&
		left.length !== right.length
	)
		return false;
	const leftRecord = left as Record<string, unknown>;
	const rightRecord = right as Record<string, unknown>;
	const keys = Object.keys(leftRecord);
	return (
		keys.length === Object.keys(rightRecord).length &&
		keys.every(
			(key) =>
				Object.hasOwn(rightRecord, key) &&
				equal(leftRecord[key], rightRecord[key], depth + 1),
		)
	);
}

function read<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(
				request.error ?? new Error("Telegram project storage read failed"),
			);
	});
}

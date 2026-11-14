import {
	WRITER_LEASE_DURATION_MS,
	type DurablePublicationCandidate,
	type NextRevisionPublicationResult,
	type ProjectDeletionPort,
	type ProjectDirectoryPort,
	type ProjectDirectoryResult,
	type ProjectLoadResult,
	type ProjectRepositoryPort,
	type ProjectRevisionPublicationPort,
	type ProjectSummary,
	type PublicationFailureReason,
	type PublicationResult,
	type WriterLease,
	type WriterLeaseAcquisition,
	type WriterLeaseStorePort,
} from "../../application/ports";
import { isStructurallyValidProjectV1 } from "../../domain/project-json-transfer";
import {
	decodeProjectV2,
	serializeProjectV2Canonically,
} from "../../domain/project-v2-codec";

export interface VersionedProjectStore {
	writeStaging(candidate: DurablePublicationCandidate): Promise<void>;
	readStaging(
		projectId: string,
	): Promise<DurablePublicationCandidate | undefined>;
	readStagingForRecovery(): Promise<readonly DurablePublicationCandidate[]>;
	publishCurrentPointer(
		candidate: DurablePublicationCandidate,
		lease?: WriterLease,
		expectedBaseRevisionId?: string,
	): Promise<"published" | "stale-base">;
	readAllCurrent(): Promise<readonly StoredCurrent[]>;
	readCurrent(): Promise<StoredCurrent>;
	readCurrentForProject(projectId: string): Promise<StoredCurrent>;
	discardStaging(projectId: string): Promise<void>;
	permanentlyDeleteProject?(
		projectId: string,
		lease?: WriterLease,
	): Promise<"permanently-deleted" | "not-found">;
}

export type StoredCurrent =
	| { readonly kind: "empty" }
	| {
			readonly kind: "candidate";
			readonly candidate: DurablePublicationCandidate;
	  }
	| { readonly kind: "corrupt" };

export class DurableProjectRepository
	implements
		ProjectRepositoryPort,
		ProjectDirectoryPort,
		ProjectRevisionPublicationPort,
		ProjectDeletionPort
{
	public constructor(
		private readonly store: VersionedProjectStore,
		private readonly checksum: (serializedProject: string) => Promise<string>,
	) {}

	public async publish(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId?: string,
	): Promise<PublicationResult> {
		const result = await this.publishCandidate(candidate, undefined, expectedBaseRevisionId);
		// Legacy callers receive the established failure result; callers needing
		// the distinct CAS outcome use publishNextRevision.
		return result.kind === "stale-base"
			? { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" }
			: result;
	}

	public async publishNextRevision(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId: string,
	): Promise<NextRevisionPublicationResult> {
		return this.publishCandidate(candidate, undefined, expectedBaseRevisionId);
	}

	/**
	 * The fencing check belongs to the same current-pointer transaction as the
	 * durable transition. FencedProjectRepository only calls this capability
	 * after acquiring a controller-scoped lease.
	 */
	public async publishWithWriterLease(
		candidate: DurablePublicationCandidate,
		lease: WriterLease,
	): Promise<PublicationResult> {
		const result = await this.publishCandidate(candidate, lease);
		return result.kind === "stale-base"
			? { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" }
			: result;
	}

	public async publishNextRevisionWithWriterLease(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId: string,
		lease: WriterLease,
	): Promise<NextRevisionPublicationResult> {
		return this.publishCandidate(candidate, lease, expectedBaseRevisionId);
	}

	private async publishCandidate(
		candidate: DurablePublicationCandidate,
		lease?: WriterLease,
		expectedBaseRevisionId?: string,
	): Promise<PublicationResult | NextRevisionPublicationResult> {
		try {
			await this.store.writeStaging(candidate);
			const staged = await this.store.readStaging(candidate.project.projectId);
			if (!staged || !(await this.isReadable(staged))) {
				return {
					kind: "persist-failed",
					reasonCode: "PERSISTENCE_WRITE_FAILED",
				};
			}
			const pointerPublication = await this.store.publishCurrentPointer(
				candidate,
				lease,
				expectedBaseRevisionId,
			);
			if (pointerPublication === "stale-base") {
				await this.store.discardStaging(staged.project.projectId);
				return { kind: "stale-base" };
			}
			return { kind: "durable" };
		} catch (error) {
			return {
				kind: "persist-failed",
				reasonCode: publicationFailureReason(error),
			};
		}
	}

	public async loadCurrent(): Promise<ProjectLoadResult> {
		try {
			const current = await this.store.readCurrent();
			if (current.kind === "empty") {
				return { kind: "empty" };
			}
			if (current.kind === "corrupt") {
				return { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
			}
			return (await this.isReadable(current.candidate))
				? { kind: "durable", candidate: current.candidate }
				: { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
		} catch {
			return { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
		}
	}

	/**
	 * Lists only independently readable current revisions. A broken pointer is
	 * a recovery signal, never a reason to hide another Project card or create
	 * a synthetic first-run state.
	 */
	public async listProjects(): Promise<ProjectDirectoryResult> {
		return this.listDirectoryCandidates(() => this.store.readAllCurrent());
	}

	/**
	 * The Project metadata transition is atomic in the versioned store. Exact
	 * resource bytes deliberately remain untouched here: their global
	 * reachability also includes other Projects, library definitions and active
	 * session/recovery roots that this repository cannot authoritatively see.
	 */
	public async permanentlyDeleteProject(
		projectId: string,
		lease?: WriterLease,
	): Promise<
		| { readonly kind: "permanently-deleted" | "not-found" }
		| { readonly kind: "persist-failed" }
	> {
		if (!this.store.permanentlyDeleteProject) {
			return { kind: "persist-failed" };
		}
		try {
			const outcome = await this.store.permanentlyDeleteProject(
				projectId,
				lease,
			);
			return outcome === "permanently-deleted"
				? { kind: "permanently-deleted" }
				: { kind: "not-found" };
		} catch {
			return { kind: "persist-failed" };
		}
	}

	private async listDirectoryCandidates(
		readCandidates: () => Promise<readonly StoredCurrent[]>,
	): Promise<ProjectDirectoryResult> {
		try {
			const currentProjects = await readCandidates();
			if (currentProjects.length === 0) {
				return { kind: "empty" };
			}
			const projects: ProjectSummary[] = [];
			let recoveryNeeded = false;
			for (const current of currentProjects) {
				if (
					current.kind !== "candidate" ||
					!(await this.isReadable(current.candidate))
				) {
					recoveryNeeded = true;
					continue;
				}
				projects.push({
					name: current.candidate.project.name,
					projectId: current.candidate.project.projectId,
					revisionId: current.candidate.revision.revisionId,
					updatedAt: current.candidate.project.updatedAt,
				});
			}
			projects.sort(
				(first, second) =>
					second.updatedAt.localeCompare(first.updatedAt) ||
					first.projectId.localeCompare(second.projectId),
			);
			if (projects.length === 0) {
				return { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
			}
			return {
				kind: "populated",
				projects,
				...(recoveryNeeded ? { recoveryNeeded: true as const } : {}),
			};
		} catch {
			return { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
		}
	}

	public async loadProject(projectId: string): Promise<ProjectLoadResult> {
		try {
			const current = await this.store.readCurrentForProject(projectId);
			if (current.kind === "empty") {
				return current;
			}
			if (
				current.kind === "corrupt" ||
				!(await this.isReadable(current.candidate))
			) {
				return { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
			}
			return { kind: "durable", candidate: current.candidate };
		} catch {
			return { kind: "recovery-needed", reasonCode: "PERSISTENCE_CORRUPT" };
		}
	}

	public async recover(): Promise<{ readonly kind: "recovered" }> {
		try {
			const stagedCandidates = await this.store.readStagingForRecovery();
			for (const staged of stagedCandidates) {
				await this.store.discardStaging(staged.project.projectId);
			}
			return { kind: "recovered" };
		} catch {
			throw new Error("Local recovery could not complete");
		}
	}

	private async isReadable(
		candidate: DurablePublicationCandidate,
	): Promise<boolean> {
		try {
			if (candidate.project.schemaVersion === 2) {
				const decoded = decodeProjectV2(candidate.revision.serializedProject);
				const canonicalCandidate = serializeProjectV2Canonically(
					candidate.project,
				);
				const checksum = await this.checksum(
					candidate.revision.serializedProject,
				);
				return (
					decoded.kind === "accepted" &&
					decoded.project.projectId === candidate.project.projectId &&
					candidate.revision.projectId === candidate.project.projectId &&
					candidate.revision.schemaVersion ===
						candidate.project.schemaVersion &&
					canonicalCandidate === candidate.revision.serializedProject &&
					checksum === candidate.revision.checksum
				);
			}
			const parsed = JSON.parse(candidate.revision.serializedProject) as {
				projectId?: unknown;
				schemaVersion?: unknown;
			};
			const checksum = await this.checksum(
				candidate.revision.serializedProject,
			);
			return (
				isStructurallyValidProjectV1(parsed) &&
				isStructurallyValidProjectV1(candidate.project) &&
				parsed.projectId === candidate.project.projectId &&
				parsed.schemaVersion === candidate.project.schemaVersion &&
				candidate.revision.projectId === candidate.project.projectId &&
				candidate.revision.schemaVersion === candidate.project.schemaVersion &&
				hasSameCanonicalJsonValue(parsed, candidate.project) &&
				checksum === candidate.revision.checksum
			);
		} catch {
			return false;
		}
	}
}

/** IndexedDB reports quota exhaustion as a named DOMException; keep the browser boundary portable. */
function publicationFailureReason(error: unknown): PublicationFailureReason {
	return isQuotaExceededError(error)
		? "PERSISTENCE_QUOTA_EXCEEDED"
		: "PERSISTENCE_WRITE_FAILED";
}

function isQuotaExceededError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "QuotaExceededError"
	);
}

function hasSameCanonicalJsonValue(left: unknown, right: unknown): boolean {
	return (
		JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right))
	);
}

function sortJsonValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortJsonValue);
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
				.map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)]),
		);
	}
	return value;
}

type FailurePoint = "before-pointer" | "before-pointer-quota";

export class MemoryVersionedProjectStore
	implements VersionedProjectStore, WriterLeaseStorePort
{
	private current: DurablePublicationCandidate | undefined;
	private readonly currentByProjectId = new Map<
		string,
		DurablePublicationCandidate
	>();
	private danglingCurrentPointer:
		| { readonly projectId: string; readonly revisionId: string }
		| undefined;
	private readonly stagedByProjectId = new Map<
		string,
		DurablePublicationCandidate
	>();
	private readonly eventLog: string[] = [];
	private readonly writerLeases = new Map<string, WriterLease>();

	public constructor(
		private readonly options: {
			readonly failAt?: FailurePoint;
			readonly nowEpochMs?: () => number;
			readonly writerLeaseDurationMs?: number;
		} = {},
	) {}

	public async writeStaging(
		candidate: DurablePublicationCandidate,
	): Promise<void> {
		this.stagedByProjectId.set(candidate.project.projectId, candidate);
		this.eventLog.push("staging-write");
	}

	public async readStaging(
		projectId: string,
	): Promise<DurablePublicationCandidate | undefined> {
		this.eventLog.push("staging-validate");
		return this.stagedByProjectId.get(projectId);
	}

	public async readStagingForRecovery(): Promise<
		readonly DurablePublicationCandidate[]
	> {
		return [...this.stagedByProjectId.values()];
	}

	public async publishCurrentPointer(
		candidate: DurablePublicationCandidate,
		lease?: WriterLease,
		expectedBaseRevisionId?: string,
	): Promise<"published" | "stale-base"> {
		if (this.options.failAt === "before-pointer") {
			this.eventLog.push("fault:before-pointer");
			throw new Error(
				"Controlled persistence fault before pointer publication",
			);
		}
		if (this.options.failAt === "before-pointer-quota") {
			this.eventLog.push("fault:before-pointer-quota");
			const error = new Error(
				"Controlled quota fault before pointer publication",
			);
			error.name = "QuotaExceededError";
			throw error;
		}
		if (
			this.stagedByProjectId.get(candidate.project.projectId)?.revision
				.revisionId !== candidate.revision.revisionId
		) {
			throw new Error("Staging revision missing before pointer publication");
		}
		if (lease && !(await this.isWriterLeaseCurrent(lease))) {
			this.eventLog.push("fence-rejected");
			throw new Error(
				"Writer fence is no longer current before pointer publication",
			);
		}
		const current = this.currentByProjectId.get(candidate.project.projectId);
		if (
			expectedBaseRevisionId !== undefined &&
			current?.revision.revisionId !== expectedBaseRevisionId
		) {
			this.eventLog.push("base-revision-rejected");
			return "stale-base";
		}
		this.current = candidate;
		this.currentByProjectId.set(candidate.project.projectId, candidate);
		this.stagedByProjectId.delete(candidate.project.projectId);
		this.eventLog.push("pointer-publish");
		return "published";
	}

	public async readCurrent(): Promise<StoredCurrent> {
		if (this.danglingCurrentPointer) {
			return { kind: "corrupt" };
		}
		return this.current
			? { kind: "candidate", candidate: this.current }
			: { kind: "empty" };
	}

	public async readCurrentForProject(
		projectId: string,
	): Promise<StoredCurrent> {
		if (this.danglingCurrentPointer?.projectId === projectId) {
			return { kind: "corrupt" };
		}
		const candidate = this.currentByProjectId.get(projectId);
		return candidate ? { kind: "candidate", candidate } : { kind: "empty" };
	}

	public async readAllCurrent(): Promise<readonly StoredCurrent[]> {
		const currents = [...this.currentByProjectId.values()].map((candidate) => ({
			kind: "candidate" as const,
			candidate,
		}));
		return this.danglingCurrentPointer
			? [...currents, { kind: "corrupt" as const }]
			: currents;
	}

	public async permanentlyDeleteProject(
		projectId: string,
		lease?: WriterLease,
	): Promise<"permanently-deleted" | "not-found"> {
		this.assertCurrentWriterLease(lease);
		if (!this.currentByProjectId.has(projectId)) return "not-found";
		this.currentByProjectId.delete(projectId);
		if (this.current?.project.projectId === projectId) {
			this.current = this.currentByProjectId.values().next().value;
		}
		this.stagedByProjectId.delete(projectId);
		this.writerLeases.delete(projectId);
		this.eventLog.push("project-permanently-deleted");
		return "permanently-deleted";
	}

	public async discardStaging(projectId: string): Promise<void> {
		const staged = this.stagedByProjectId.get(projectId);
		if (staged) {
			const keepsCurrentRevision =
				this.current?.revision.revisionId === staged.revision.revisionId;
			this.stagedByProjectId.delete(projectId);
			this.eventLog.push(
				keepsCurrentRevision
					? "recovery-preserve-current-revision"
					: "recovery-discard-staging",
			);
		}
	}

	public async seedInterruptedStaging(
		candidate: DurablePublicationCandidate,
	): Promise<void> {
		this.stagedByProjectId.set(candidate.project.projectId, candidate);
	}

	public async seedPublishedPointerWithResidualStaging(
		candidate: DurablePublicationCandidate,
	): Promise<void> {
		this.current = candidate;
		this.currentByProjectId.set(candidate.project.projectId, candidate);
		this.stagedByProjectId.set(candidate.project.projectId, candidate);
	}

	public async seedDanglingCurrentPointer(
		projectId: string,
		revisionId: string,
	): Promise<void> {
		this.danglingCurrentPointer = { projectId, revisionId };
	}

	public events(): readonly string[] {
		return this.eventLog;
	}

	private assertCurrentWriterLease(lease: WriterLease | undefined): void {
		if (!lease) return;
		const current = this.writerLeases.get(lease.projectId);
		if (
			current?.ownerId !== lease.ownerId ||
			current.fencingToken !== lease.fencingToken ||
			current.expiresAtEpochMs <= (this.options.nowEpochMs?.() ?? Date.now())
		) {
			throw new Error(
				"Writer fence is no longer current before permanent Project deletion",
			);
		}
	}

	public async acquireWriterLease(
		projectId: string,
		ownerId: string,
	): Promise<WriterLeaseAcquisition> {
		const nowEpochMs = this.options.nowEpochMs?.() ?? Date.now();
		const current = this.writerLeases.get(projectId);
		if (
			current &&
			current.expiresAtEpochMs > nowEpochMs &&
			current.ownerId !== ownerId
		) {
			return { kind: "held-by-another-writer" };
		}
		const lease: WriterLease = {
			expiresAtEpochMs:
				nowEpochMs +
				(this.options.writerLeaseDurationMs ?? WRITER_LEASE_DURATION_MS),
			fencingToken:
				current &&
				current.expiresAtEpochMs > nowEpochMs &&
				current.ownerId === ownerId
					? current.fencingToken
					: (current?.fencingToken ?? 0) + 1,
			ownerId,
			projectId,
		};
		this.writerLeases.set(projectId, lease);
		return { kind: "acquired", lease };
	}

	public async inspectWriterLease(
		projectId: string,
	): Promise<WriterLease | undefined> {
		return this.writerLeases.get(projectId);
	}

	public async isWriterLeaseCurrent(lease: WriterLease): Promise<boolean> {
		const current = this.writerLeases.get(lease.projectId);
		return (
			current?.ownerId === lease.ownerId &&
			current.fencingToken === lease.fencingToken &&
			current.expiresAtEpochMs > (this.options.nowEpochMs?.() ?? Date.now())
		);
	}

	public async takeOverWriterLease(
		projectId: string,
		ownerId: string,
	): Promise<WriterLease> {
		const nowEpochMs = this.options.nowEpochMs?.() ?? Date.now();
		const next: WriterLease = {
			expiresAtEpochMs:
				nowEpochMs +
				(this.options.writerLeaseDurationMs ?? WRITER_LEASE_DURATION_MS),
			fencingToken: (this.writerLeases.get(projectId)?.fencingToken ?? 0) + 1,
			ownerId,
			projectId,
		};
		this.writerLeases.set(projectId, next);
		return next;
	}
}

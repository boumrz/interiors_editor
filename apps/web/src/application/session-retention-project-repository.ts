import type {
	DurablePublicationCandidate,
	NextRevisionPublicationResult,
	PublicationFailureReason,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	PublicationResult,
} from "./ports";
import { copyProject } from "../domain/copy-project";
import {
	assessSessionRetention,
	type SessionRetentionLimits,
} from "./session-retention-policy";
import {
	assessBackupFeasibility,
	type BackupFeasibilityPolicyPort,
	type BackupFeasibilityResourcePorts,
} from "./backup-feasibility-policy";

export interface SessionHistoryRootSnapshot {
	readonly current: DurablePublicationCandidate | undefined;
	readonly limits?: SessionRetentionLimits;
	readonly redo: readonly DurablePublicationCandidate[];
	readonly undo: readonly DurablePublicationCandidate[];
}

/** Read-only session roots owned by the controller, never by persistence. */
export interface SessionHistoryRootsPort {
	snapshot(): SessionHistoryRootSnapshot;
}

/**
 * Enforces history resource admission at the publication boundary. The
 * controller remains the sole owner of stacks; this adapter observes them
 * before the delegate can allocate a durable revision or move a pointer.
 */
export class SessionRetentionProjectRepository
	implements
		ProjectRepositoryPort<PublicationFailureReason>,
		ProjectRevisionPublicationPort<PublicationFailureReason>
{
	public constructor(
		private readonly delegate: ProjectRepositoryPort &
			ProjectRevisionPublicationPort,
		private readonly historyRoots: SessionHistoryRootsPort,
		private readonly backupFeasibilityResourcePorts?: BackupFeasibilityResourcePorts,
		private readonly backupFeasibilityPolicy?: BackupFeasibilityPolicyPort,
	) {}

	public async publish(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId?: string,
	): Promise<PublicationResult<PublicationFailureReason>> {
		return this.withAdmission(candidate, (owned) =>
			this.delegate.publish(owned, expectedBaseRevisionId),
		);
	}

	public loadCurrent() {
		return this.delegate.loadCurrent();
	}

	public async publishNextRevision(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId: string,
		intent?: "history",
	): Promise<NextRevisionPublicationResult<PublicationFailureReason>> {
		return this.withAdmission(candidate, (owned) =>
			this.delegate.publishNextRevision(owned, expectedBaseRevisionId, intent),
		);
	}

	public recover() {
		return this.delegate.recover();
	}

	private async withAdmission<
		Result extends
			| PublicationResult<PublicationFailureReason>
			| NextRevisionPublicationResult<PublicationFailureReason>,
	>(
		input: DurablePublicationCandidate,
		publish: (candidate: DurablePublicationCandidate) => Promise<Result>,
	): Promise<Result> {
		const candidate =
			this.backupFeasibilityPolicy &&
			input.project.schemaVersion === 1 &&
			input.revision.schemaVersion === 1
				? {
						project: copyProject(input.project),
						revision: { ...input.revision },
					}
				: input;
		const backupFeasibility = await (this.backupFeasibilityPolicy
			? this.backupFeasibilityPolicy.assess(
					candidate,
					this.backupFeasibilityResourcePorts,
				)
			: assessBackupFeasibility(
					candidate,
					this.backupFeasibilityResourcePorts,
				));
		if (backupFeasibility.kind === "rejected") {
			return {
				kind: "persist-failed",
				reasonCode: backupFeasibility.reasonCode,
			} as Result;
		}

		const roots = this.historyRoots.snapshot();

		// Create/import/duplicate begin a separate session boundary. Only a new
		// command for the active Project inherits its undo/redo resource roots.
		if (
			!roots.current ||
			roots.current.project.projectId !== candidate.project.projectId
		) {
			return publish(candidate);
		}

		const decision = assessSessionRetention({
			current: roots.current,
			limits: roots.limits,
			prospective: candidate,
			redo: roots.redo,
			undo: roots.undo,
		});
		if (decision.kind === "accepted") {
			return publish(candidate);
		}

		return {
			kind: "persist-failed",
			reasonCode: decision.reasonCode,
		} as Result;
	}
}

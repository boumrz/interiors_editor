import type {
	DurablePublicationCandidate,
	NextRevisionPublicationResult,
	ProjectDirectoryPort,
	ProjectDirectoryResult,
	ProjectLoadResult,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	ProjectDeletionPort,
	PublicationResult,
	WriterAccess,
	WriterLease,
	WriterLeaseControllerPort,
	WriterLeaseStorePort,
	WriterTakeoverRequirementStorePort,
} from "../../application/ports";

/**
 * Optional stronger capability used by the durable adapter. Implementations
 * that own the physical current-pointer transaction re-check the fence there.
 */
interface FencedPublicationRepositoryPort extends ProjectRepositoryPort {
	publishWithWriterLease(
		candidate: DurablePublicationCandidate,
		lease: WriterLease,
	): Promise<PublicationResult>;
}

interface FencedNextRevisionPublicationRepositoryPort
	extends ProjectRevisionPublicationPort {
	publishNextRevisionWithWriterLease(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId: string,
		lease: WriterLease,
		intent?: "history",
	): Promise<NextRevisionPublicationResult>;
}

function supportsProjectDirectory(
	repository: ProjectRepositoryPort,
): repository is ProjectRepositoryPort & ProjectDirectoryPort {
	return (
		"listProjects" in repository &&
		typeof repository.listProjects === "function" &&
		"loadProject" in repository &&
		typeof repository.loadProject === "function"
	);
}

function supportsProjectDeletion(
	repository: ProjectRepositoryPort,
): repository is ProjectRepositoryPort & ProjectDeletionPort {
	return (
		"permanentlyDeleteProject" in repository &&
		typeof repository.permanentlyDeleteProject === "function"
	);
}

function supportsFencedPublication(
	repository: ProjectRepositoryPort,
): repository is FencedPublicationRepositoryPort {
	return (
		"publishWithWriterLease" in repository &&
		typeof repository.publishWithWriterLease === "function"
	);
}

function supportsFencedNextRevisionPublication(
	repository: ProjectRepositoryPort,
): repository is ProjectRepositoryPort &
	FencedNextRevisionPublicationRepositoryPort {
	return (
		"publishNextRevisionWithWriterLease" in repository &&
		typeof repository.publishNextRevisionWithWriterLease === "function"
	);
}

class InMemoryWriterTakeoverRequirementStore
	implements WriterTakeoverRequirementStorePort
{
	private readonly requiredProjectIds = new Set<string>();

	public requiresExplicitTakeover(projectId: string): boolean {
		return this.requiredProjectIds.has(projectId);
	}

	public requireExplicitTakeover(projectId: string): void {
		this.requiredProjectIds.add(projectId);
	}

	public clearExplicitTakeoverRequirement(projectId: string): void {
		this.requiredProjectIds.delete(projectId);
	}
}

/**
 * One controller receives one instance. It acquires a Project-scoped lease
 * just before its first publication and never lets a stale fence reach a
 * publish-capable durable adapter.
 */
export class FencedProjectRepository
	implements
		ProjectRepositoryPort,
		ProjectDirectoryPort,
		ProjectDeletionPort,
		ProjectRevisionPublicationPort,
		WriterLeaseControllerPort
{
	private lease: WriterLease | undefined;
	private lostWriterLease = false;

	public constructor(
		private readonly delegate: ProjectRepositoryPort,
		private readonly leases: WriterLeaseStorePort,
		private readonly ownerId: string,
		private readonly takeoverRequirements: WriterTakeoverRequirementStorePort =
			new InMemoryWriterTakeoverRequirementStore(),
	) {}

	public async publish(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId?: string,
	): Promise<PublicationResult> {
		if (expectedBaseRevisionId !== undefined) {
			const result = await this.publishNextRevision(candidate, expectedBaseRevisionId);
			return result.kind === "stale-base"
				? { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" }
				: result;
		}
		const lease = await this.leaseFor(candidate.project.projectId);
		if (!lease) {
			this.lostWriterLease = true;
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		}
		if (!(await this.leases.isWriterLeaseCurrent(lease))) {
			this.lostWriterLease = true;
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		}
		const publication = supportsFencedPublication(this.delegate)
			? this.delegate.publishWithWriterLease(candidate, lease)
			: this.delegate.publish(candidate);
		const result = await publication;
		// A takeover can occur after the optimistic preflight. The durable adapter
		// rejects its pointer transaction; re-reading the token turns that generic
		// persistence failure into the controller's stable lost-lease outcome.
		if (
			result.kind === "persist-failed" &&
			!(await this.leases.isWriterLeaseCurrent(lease))
		) {
			this.lostWriterLease = true;
		}
		return result;
	}

	public async publishNextRevision(
		candidate: DurablePublicationCandidate,
		expectedBaseRevisionId: string,
		intent?: "history",
	): Promise<NextRevisionPublicationResult> {
		const lease = await this.leaseFor(candidate.project.projectId);
		if (!lease || !(await this.leases.isWriterLeaseCurrent(lease))) {
			this.lostWriterLease = true;
			return { kind: "persist-failed", reasonCode: "PERSISTENCE_WRITE_FAILED" };
		}
		const result = supportsFencedNextRevisionPublication(this.delegate)
			? await this.delegate.publishNextRevisionWithWriterLease(
					candidate,
					expectedBaseRevisionId,
					lease,
					intent,
				)
			: {
					kind: "persist-failed" as const,
					reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
				};
		if (
			result.kind === "persist-failed" &&
			!(await this.leases.isWriterLeaseCurrent(lease))
		) {
			this.lostWriterLease = true;
		}
		return result;
	}

	public loadCurrent(): Promise<ProjectLoadResult> {
		return this.delegate.loadCurrent();
	}

	public listProjects(): Promise<ProjectDirectoryResult> {
		return supportsProjectDirectory(this.delegate)
			? this.delegate.listProjects()
			: Promise.resolve({
					kind: "recovery-needed",
					reasonCode: "PERSISTENCE_CORRUPT",
				});
	}

	public loadProject(projectId: string): Promise<ProjectLoadResult> {
		return supportsProjectDirectory(this.delegate)
			? this.delegate.loadProject(projectId)
			: Promise.resolve({
					kind: "recovery-needed",
					reasonCode: "PERSISTENCE_CORRUPT",
				});
	}

	public async permanentlyDeleteProject(
		projectId: string,
	): Promise<
		| { readonly kind: "permanently-deleted" | "not-found" }
		| { readonly kind: "persist-failed" }
	> {
		const lease = await this.leaseFor(projectId);
		if (!lease || !(await this.leases.isWriterLeaseCurrent(lease))) {
			this.lostWriterLease = true;
			return { kind: "persist-failed" };
		}
		const result = supportsProjectDeletion(this.delegate)
			? await this.delegate.permanentlyDeleteProject(projectId, lease)
			: { kind: "persist-failed" as const };
		if (
			result.kind === "persist-failed" &&
			!(await this.leases.isWriterLeaseCurrent(lease))
		) {
			this.lostWriterLease = true;
		}
		return result;
	}

	public recover(): Promise<{ readonly kind: "recovered" }> {
		return this.delegate.recover();
	}

	public async inspectWriterAccess(projectId: string): Promise<WriterAccess> {
		if (this.takeoverRequirements.requiresExplicitTakeover(projectId)) {
			return { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" };
		}
		const acquisition = await this.leases.acquireWriterLease(
			projectId,
			this.ownerId,
		);
		if (acquisition.kind === "acquired") {
			this.takeoverRequirements.clearExplicitTakeoverRequirement(projectId);
			this.lease = acquisition.lease;
			return {
				kind: "writable",
				fencingToken: acquisition.lease.fencingToken,
			};
		}
		this.takeoverRequirements.requireExplicitTakeover(projectId);
		return { kind: "read-only", reasonCode: "WRITER_LEASE_HELD" };
	}

	public async takeOverWriterLease(projectId: string): Promise<WriterAccess> {
		this.lease = await this.leases.takeOverWriterLease(projectId, this.ownerId);
		this.takeoverRequirements.clearExplicitTakeoverRequirement(projectId);
		this.lostWriterLease = false;
		return { kind: "writable", fencingToken: this.lease.fencingToken };
	}

	public consumeLostWriterLease(): boolean {
		const lost = this.lostWriterLease;
		this.lostWriterLease = false;
		return lost;
	}

	private async leaseFor(projectId: string): Promise<WriterLease | undefined> {
		if (this.takeoverRequirements.requiresExplicitTakeover(projectId)) {
			return undefined;
		}
		const acquisition = await this.leases.acquireWriterLease(
			projectId,
			this.ownerId,
		);
		if (acquisition.kind !== "acquired") {
			this.takeoverRequirements.requireExplicitTakeover(projectId);
			return undefined;
		}
		this.takeoverRequirements.clearExplicitTakeoverRequirement(projectId);
		this.lease = acquisition.lease;
		return this.lease;
	}
}

import {
	migrateProjectV1ToV2,
	type MigrateProjectV1ToV2Reason,
} from "../domain/migrate-project-v1-to-v2";
import {
	PROJECT_V2_SCHEMA_VERSION,
	type RevisionV2,
} from "../domain/project-v2";
import {
	publishV2ProjectMutation,
	type V2ProjectMutationPublicationResult,
	type V2ProjectMutationPublicationStatus,
} from "./v2-project-mutation-publication";
import type {
	ChecksumPort,
	ClockPort,
	IdPort,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	ProjectSerializerPort,
	PublicationCandidate,
	V2PublicationCandidate,
} from "./ports";

export type MigrateProjectV1ToV2Status = V2ProjectMutationPublicationStatus;

export type MigrateProjectV1ToV2UseCaseResult =
	| {
			readonly kind: "rejected";
			readonly reasonCode: MigrateProjectV1ToV2Reason;
	  }
	| V2ProjectMutationPublicationResult;

interface MigrateProjectV1ToV2Dependencies {
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly repository: ProjectRepositoryPort<
		import("./ports").PublicationFailureReason
	> &
		ProjectRevisionPublicationPort<import("./ports").PublicationFailureReason>;
	readonly serializer: ProjectSerializerPort;
}

/** Writes one v2 Durable Revision only after pure v1→v2 reconciliation succeeds. */
export class MigrateProjectV1ToV2UseCase {
	public constructor(
		private readonly dependencies: MigrateProjectV1ToV2Dependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		onStatus: (status: MigrateProjectV1ToV2Status) => void,
	): Promise<MigrateProjectV1ToV2UseCaseResult> {
		const migrated = migrateProjectV1ToV2(base.project);
		if (migrated.kind === "rejected") {
			return migrated;
		}
		const updatedProject = {
			...migrated.project,
			updatedAt: this.dependencies.clock.now(),
		};
		const serializedProject =
			this.dependencies.serializer.serialize(updatedProject);
		const revision: RevisionV2 = {
			checksum: await this.dependencies.checksum.sha256(serializedProject),
			createdAt: updatedProject.updatedAt,
			projectId: updatedProject.projectId,
			revisionId: this.dependencies.ids.next(),
			schemaVersion: PROJECT_V2_SCHEMA_VERSION,
			serializedProject,
		};
		const candidate: V2PublicationCandidate = {
			project: updatedProject,
			revision,
		};
		return publishV2ProjectMutation(
			candidate,
			base.revision.revisionId,
			this.dependencies.repository,
			onStatus,
		);
	}
}

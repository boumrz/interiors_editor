import {
	addWallToProjectV2,
	type AddWallToProjectV2Result,
} from "../domain/add-wall-to-project-v2";
import type { AddWallSegmentInput } from "../domain/add-wall-segment";
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
	V2PublicationCandidate,
} from "./ports";

export type AddWallToProjectV2Status = V2ProjectMutationPublicationStatus;

export type AddWallToProjectV2UseCaseResult =
	| Exclude<AddWallToProjectV2Result, { readonly kind: "accepted" }>
	| V2ProjectMutationPublicationResult;

interface AddWallToProjectV2Dependencies {
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly repository: ProjectRepositoryPort<
		import("./ports").PublicationFailureReason
	> &
		ProjectRevisionPublicationPort<import("./ports").PublicationFailureReason>;
	readonly serializer: ProjectSerializerPort;
}

export class AddWallToProjectV2UseCase {
	public constructor(
		private readonly dependencies: AddWallToProjectV2Dependencies,
	) {}

	public async execute(
		base: V2PublicationCandidate,
		input: AddWallSegmentInput,
		onStatus: (status: AddWallToProjectV2Status) => void,
	): Promise<AddWallToProjectV2UseCaseResult> {
		const updated = addWallToProjectV2(
			base.project,
			input,
			this.dependencies.ids,
			this.dependencies.clock.now(),
		);
		if (updated.kind === "rejected") {
			return updated;
		}
		const serializedProject = this.dependencies.serializer.serialize(
			updated.project,
		);
		const revision: RevisionV2 = {
			checksum: await this.dependencies.checksum.sha256(serializedProject),
			createdAt: updated.project.updatedAt,
			projectId: updated.project.projectId,
			revisionId: this.dependencies.ids.next(),
			schemaVersion: PROJECT_V2_SCHEMA_VERSION,
			serializedProject,
		};
		const candidate: V2PublicationCandidate = {
			project: updated.project,
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

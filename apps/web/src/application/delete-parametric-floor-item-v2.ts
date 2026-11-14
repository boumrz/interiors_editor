import {
	deleteParametricFloorItemV2,
	type DeleteParametricFloorItemV2Result,
} from "../domain/parametric-item-v2";
import type { DeleteParametricFloorItemInput } from "../domain/parametric-item";
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

export type DeleteParametricFloorItemV2Status =
	V2ProjectMutationPublicationStatus;

export type DeleteParametricFloorItemV2UseCaseResult =
	| Exclude<DeleteParametricFloorItemV2Result, { readonly kind: "accepted" }>
	| V2ProjectMutationPublicationResult;

interface DeleteParametricFloorItemV2Dependencies {
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly repository: ProjectRepositoryPort<
		import("./ports").PublicationFailureReason
	> &
		ProjectRevisionPublicationPort<import("./ports").PublicationFailureReason>;
	readonly serializer: ProjectSerializerPort;
}

/** Publishes a v2 floor-greybox deletion as one atomic Durable Revision. */
export class DeleteParametricFloorItemV2UseCase {
	public constructor(
		private readonly dependencies: DeleteParametricFloorItemV2Dependencies,
	) {}

	public async execute(
		base: V2PublicationCandidate,
		input: DeleteParametricFloorItemInput,
		onStatus: (status: DeleteParametricFloorItemV2Status) => void,
	): Promise<DeleteParametricFloorItemV2UseCaseResult> {
		const updated = deleteParametricFloorItemV2(
			base.project,
			input,
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

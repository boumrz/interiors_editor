import { moveParametricFloorItemV2 } from "../domain/parametric-item-v2";
import type { MoveParametricFloorItemInput } from "../domain/parametric-item";
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

export type MoveParametricFloorItemV2Status =
	V2ProjectMutationPublicationStatus;

export type MoveParametricFloorItemV2UseCaseResult =
	| Exclude<
			ReturnType<typeof moveParametricFloorItemV2>,
			{ readonly kind: "accepted" }
	  >
	| V2ProjectMutationPublicationResult;

interface MoveParametricFloorItemV2Dependencies {
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly repository: ProjectRepositoryPort<
		import("./ports").PublicationFailureReason
	> &
		ProjectRevisionPublicationPort<import("./ports").PublicationFailureReason>;
	readonly serializer: ProjectSerializerPort;
}

/** Publishes a v2 item movement only after the derived room host remains valid. */
export class MoveParametricFloorItemV2UseCase {
	public constructor(
		private readonly dependencies: MoveParametricFloorItemV2Dependencies,
	) {}

	public async execute(
		base: V2PublicationCandidate,
		input: MoveParametricFloorItemInput,
		onStatus: (status: MoveParametricFloorItemV2Status) => void,
	): Promise<MoveParametricFloorItemV2UseCaseResult> {
		const updated = moveParametricFloorItemV2(
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

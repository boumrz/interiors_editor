import type { AddWallSegmentInput } from "../domain/add-wall-segment";
import {
	type AddGeneralWallHostResolutionInput,
	addGeneralWallToProject,
	addGeneralWallToProjectWithHostResolution,
	type ChangeGeneralWallThicknessInput,
	changeGeneralWallThickness,
	type DeleteGeneralVertexInput,
	type DeleteGeneralWallRoomMetadataResolution,
	deleteGeneralVertex,
	deleteGeneralWallFromProject,
	deleteGeneralWallWithConsequenceResolution,
	deleteGeneralWallWithOpeningResolution,
	type GeneralWallProjectMutationResult,
	type MoveGeneralVertexInput,
	type MoveGeneralWallInput,
	moveGeneralVertex,
	moveGeneralWall,
	previewWallDeletionConflict,
	type ReverseGeneralWallInput,
	reconcileMissingRoomsFromPlanGraph,
	reverseGeneralWall,
	type SplitGeneralWallHostResolutionInput,
	type SplitGeneralWallInput,
	type SplitGeneralWallOpeningResolutionInput,
	splitGeneralWall,
	splitGeneralWallWithHostResolution,
	splitGeneralWallWithOpeningResolution,
} from "../domain/general-wall-project";
import { PROJECT_SCHEMA_VERSION, type Revision } from "../domain/project";
import type {
	ChecksumPort,
	ClockPort,
	IdPort,
	ProjectRepositoryPort,
	ProjectRevisionPublicationPort,
	ProjectSerializerPort,
	PublicationCandidate,
} from "./ports";

export type GeneralWallProjectMutationStatus =
	| { readonly kind: "saving" }
	| { readonly kind: "saved"; readonly candidate: PublicationCandidate }
	| {
			readonly candidate: PublicationCandidate;
			readonly kind: "stale-base";
			readonly reasonCode: "STALE_BASE_REVISION";
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: import("./ports").PublicationFailureReason;
			readonly candidate: PublicationCandidate;
	  };

export type GeneralWallProjectMutationUseCaseResult =
	| Exclude<GeneralWallProjectMutationResult, { readonly kind: "accepted" }>
	| {
			readonly kind: "durable";
			readonly projectId: string;
			readonly revisionId: string;
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: import("./ports").PublicationFailureReason;
	  }
	| { readonly kind: "stale-base"; readonly reasonCode: "STALE_BASE_REVISION" }
	| { readonly kind: "unchanged" };

interface GeneralWallProjectMutationDependencies {
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly repository: ProjectRepositoryPort<
		import("./ports").PublicationFailureReason
	> &
		Partial<
			ProjectRevisionPublicationPort<import("./ports").PublicationFailureReason>
		>;
	readonly serializer: ProjectSerializerPort;
}

/** Persists one explicitly drawn wall segment without falling back to a grid divider. */
export class AddGeneralWallToProjectUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		input: AddWallSegmentInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		const updated = addGeneralWallToProject(
			base.project,
			input,
			this.dependencies.ids,
			this.dependencies.clock.now(),
		);
		return publishWallMutation(
			updated,
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}

	/** Publishes one refreshed deletion of hosts cut by an exact AddWall T/X contact. */
	public async resolveHostConflict(
		base: PublicationCandidate,
		input: AddGeneralWallHostResolutionInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		return publishWallMutation(
			addGeneralWallToProjectWithHostResolution(
				base.project,
				input,
				this.dependencies.ids,
				this.dependencies.clock.now(),
			),
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

/** Persists deletion of exactly the selected canonical segment, including a face-closing segment. */
export class DeleteGeneralWallFromProjectUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		input: {
			readonly itemIds?: readonly string[];
			readonly openingIds?: readonly string[];
			readonly roomIds?: readonly string[];
			readonly roomMetadataResolutions?: readonly DeleteGeneralWallRoomMetadataResolution[];
			readonly wallSegmentId: string;
		},
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		const preview = previewWallDeletionConflict(base.project, input);
		const updated =
			preview.kind === "conflict" &&
			(input.itemIds === undefined ||
				input.openingIds === undefined ||
				input.roomIds === undefined)
				? {
						kind: "rejected" as const,
						reasonCode: "WALL_DELETION_CONFLICT" as const,
					}
				: input.itemIds !== undefined &&
						input.openingIds !== undefined &&
						input.roomIds !== undefined
					? deleteGeneralWallWithConsequenceResolution(
							base.project,
							{
								itemIds: input.itemIds,
								openingIds: input.openingIds,
								roomIds: input.roomIds,
								roomMetadataResolutions: input.roomMetadataResolutions,
								wallSegmentId: input.wallSegmentId,
							},
							this.dependencies.clock.now(),
						)
					: input.openingIds === undefined
						? deleteGeneralWallFromProject(
								base.project,
								input,
								this.dependencies.clock.now(),
							)
						: deleteGeneralWallWithOpeningResolution(
								base.project,
								{
									openingIds: input.openingIds,
									wallSegmentId: input.wallSegmentId,
								},
								this.dependencies.clock.now(),
							);
		return publishWallMutation(
			updated,
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

/** Persists a width-only edit of one selected canonical wall segment. */
export class ChangeGeneralWallThicknessUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		input: ChangeGeneralWallThicknessInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		const selected = base.project.level.wallSegments.find(
			(wall) => wall.wallSegmentId === input.wallSegmentId,
		);
		if (selected?.thicknessMm === input.thicknessMm) {
			return { kind: "unchanged" };
		}
		const updated = changeGeneralWallThickness(
			base.project,
			input,
			this.dependencies.clock.now(),
		);
		return publishWallMutation(
			updated,
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

/** Persists a direction-only Wall mutation while retaining all local hosts. */
export class ReverseGeneralWallUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		input: ReverseGeneralWallInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		return publishWallMutation(
			reverseGeneralWall(base.project, input, this.dependencies.clock.now()),
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

/** Publishes an exact parallel move of one selected canonical wall segment. */
export class MoveGeneralWallUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		input: MoveGeneralWallInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		return publishWallMutation(
			moveGeneralWall(base.project, input, this.dependencies.clock.now()),
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

/** Publishes an exact safe move of one canonical graph Vertex. */
export class MoveGeneralVertexUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		input: MoveGeneralVertexInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		return publishWallMutation(
			moveGeneralVertex(base.project, input, this.dependencies.clock.now()),
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

/** Publishes removal of one already-proven redundant inline Vertex. */
export class DeleteGeneralVertexUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		input: DeleteGeneralVertexInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		return publishWallMutation(
			deleteGeneralVertex(base.project, input, this.dependencies.clock.now()),
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

/** Publishes one exact split of the selected canonical wall segment. */
export class SplitGeneralWallUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		input: SplitGeneralWallInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		return publishWallMutation(
			splitGeneralWall(
				base.project,
				input,
				this.dependencies.ids,
				this.dependencies.clock.now(),
			),
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}

	/** Publishes one refreshed, explicit removal of Openings cut by a wall split. */
	public async resolveOpeningConflict(
		base: PublicationCandidate,
		input: SplitGeneralWallOpeningResolutionInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		return publishWallMutation(
			splitGeneralWallWithOpeningResolution(
				base.project,
				input,
				this.dependencies.ids,
				this.dependencies.clock.now(),
			),
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}

	/** Publishes one refreshed deletion of every hosted resource cut by a split. */
	public async resolveHostConflict(
		base: PublicationCandidate,
		input: SplitGeneralWallHostResolutionInput,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<GeneralWallProjectMutationUseCaseResult> {
		return publishWallMutation(
			splitGeneralWallWithHostResolution(
				base.project,
				input,
				this.dependencies.ids,
				this.dependencies.clock.now(),
			),
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

/**
 * Publishes the narrow one-time repair for pre-fix manual contours whose
 * already-valid walls were saved without their derived Room records.
 */
export class ReconcileMissingRoomsFromPlanGraphUseCase {
	public constructor(
		private readonly dependencies: GeneralWallProjectMutationDependencies,
	) {}

	public async execute(
		base: PublicationCandidate,
		onStatus: (status: GeneralWallProjectMutationStatus) => void,
	): Promise<
		GeneralWallProjectMutationUseCaseResult | { readonly kind: "unchanged" }
	> {
		const reconciled = reconcileMissingRoomsFromPlanGraph(
			base.project,
			this.dependencies.ids,
			this.dependencies.clock.now(),
		);
		if (!reconciled.changed) {
			return { kind: "unchanged" };
		}
		return publishWallMutation(
			reconciled,
			this.dependencies,
			onStatus,
			base.revision.revisionId,
		);
	}
}

async function publishWallMutation(
	updated: GeneralWallProjectMutationResult,
	dependencies: GeneralWallProjectMutationDependencies,
	onStatus: (status: GeneralWallProjectMutationStatus) => void,
	expectedBaseRevisionId: string,
): Promise<GeneralWallProjectMutationUseCaseResult> {
	if (updated.kind === "rejected") {
		return updated;
	}
	const serializedProject = dependencies.serializer.serialize(updated.project);
	const revision: Revision = {
		checksum: await dependencies.checksum.sha256(serializedProject),
		createdAt: updated.project.updatedAt,
		projectId: updated.project.projectId,
		revisionId: dependencies.ids.next(),
		schemaVersion: PROJECT_SCHEMA_VERSION,
		serializedProject,
	};
	const candidate = { project: updated.project, revision };
	onStatus({ kind: "saving" });
	const publication = dependencies.repository.publishNextRevision
		? await dependencies.repository.publishNextRevision(
				candidate,
				expectedBaseRevisionId,
			)
		: {
				kind: "persist-failed" as const,
				reasonCode: "PERSISTENCE_WRITE_FAILED" as const,
			};
	if (publication.kind === "stale-base") {
		const stale = {
			kind: "stale-base" as const,
			reasonCode: "STALE_BASE_REVISION" as const,
		};
		onStatus({ ...stale, candidate });
		return stale;
	}
	if (publication.kind === "persist-failed") {
		onStatus({ ...publication, candidate });
		return publication;
	}
	onStatus({ candidate, kind: "saved" });
	return {
		kind: "durable",
		projectId: updated.project.projectId,
		revisionId: revision.revisionId,
	};
}

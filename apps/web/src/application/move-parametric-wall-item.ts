import { supportedItemConflict } from "../domain/interior-support";
import {
	moveParametricWallItem,
	type MoveParametricWallItemInput,
	type MoveParametricWallItemResult,
	type ParametricWallItemPlacementWarning,
} from "../domain/parametric-wall-item";
import { PROJECT_SCHEMA_VERSION, type Revision } from "../domain/project";
import type {
	ChecksumPort,
	ClockPort,
	IdPort,
	ProjectRepositoryPort,
	ProjectSerializerPort,
	PublicationCandidate,
} from "./ports";

export type MoveParametricWallItemStatus =
	| { readonly kind: "saving" }
	| { readonly kind: "saved"; readonly candidate: PublicationCandidate }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: import("./ports").PublicationFailureReason;
			readonly candidate: PublicationCandidate;
	  };

export type MoveParametricWallItemUseCaseResult =
	| Exclude<MoveParametricWallItemResult, { readonly kind: "accepted" }>
	| {
			readonly kind: "durable";
			readonly projectId: string;
			readonly revisionId: string;
			readonly warnings?: readonly ParametricWallItemPlacementWarning[];
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: import("./ports").PublicationFailureReason;
	  };

interface Dependencies {
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly repository: ProjectRepositoryPort<
		import("./ports").PublicationFailureReason
	>;
	readonly serializer: ProjectSerializerPort;
}

/** Publishes one validated wall-local move through the ordinary revision boundary. */
export class MoveParametricWallItemUseCase {
	public constructor(private readonly dependencies: Dependencies) {}

	public async execute(
		base: PublicationCandidate,
		input: MoveParametricWallItemInput,
		onStatus: (status: MoveParametricWallItemStatus) => void,
	): Promise<MoveParametricWallItemUseCaseResult> {
		const updated = moveParametricWallItem(
			base.project,
			input,
			this.dependencies.clock.now(),
		);
		if (updated.kind === "rejected") return updated;
		const conflictAssetInstanceId = supportedItemConflict(updated.project);
		if (conflictAssetInstanceId !== undefined)
			return { kind: "rejected", reasonCode: "WALL_ITEM_COLLISION", conflictAssetInstanceId };

		const serializedProject = this.dependencies.serializer.serialize(
			updated.project,
		);
		const revision: Revision = {
			checksum: await this.dependencies.checksum.sha256(serializedProject),
			createdAt: updated.project.updatedAt,
			projectId: updated.project.projectId,
			revisionId: this.dependencies.ids.next(),
			schemaVersion: PROJECT_SCHEMA_VERSION,
			serializedProject,
		};
		const candidate = { project: updated.project, revision };
		onStatus({ kind: "saving" });
		const publication = await this.dependencies.repository.publish(candidate, base.revision.revisionId);
		if (publication.kind === "persist-failed") {
			onStatus({ ...publication, candidate });
			return publication;
		}
		onStatus({ candidate, kind: "saved" });
		return {
			kind: "durable",
			projectId: updated.project.projectId,
			revisionId: revision.revisionId,
			...(updated.warnings === undefined ? {} : { warnings: updated.warnings }),
		};
	}
}

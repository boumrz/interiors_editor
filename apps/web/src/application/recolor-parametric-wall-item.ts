import {
	recolorParametricWallItem,
	type RecolorParametricWallItemInput,
	type RecolorParametricWallItemResult,
} from "../domain/parametric-wall-item";
import { PROJECT_SCHEMA_VERSION, type Revision } from "../domain/project";
import type {
	ChecksumPort,
	ClockPort,
	IdPort,
	ProjectRevisionPublicationPort,
	ProjectSerializerPort,
	PublicationCandidate,
} from "./ports";

export type RecolorParametricWallItemStatus =
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

export type RecolorParametricWallItemUseCaseResult =
	| Exclude<RecolorParametricWallItemResult, { readonly kind: "accepted" }>
	| { readonly kind: "durable"; readonly projectId: string; readonly revisionId: string }
	| { readonly kind: "stale-base"; readonly reasonCode: "STALE_BASE_REVISION" }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: import("./ports").PublicationFailureReason;
	  };

interface Dependencies {
	readonly checksum: ChecksumPort;
	readonly clock: ClockPort;
	readonly ids: IdPort;
	readonly repository: ProjectRevisionPublicationPort<
		import("./ports").PublicationFailureReason
	>;
	readonly serializer: ProjectSerializerPort;
}

/** Publishes one declared colour variant of a wall-local item. */
export class RecolorParametricWallItemUseCase {
	public constructor(private readonly dependencies: Dependencies) {}

	public async execute(
		base: PublicationCandidate,
		input: RecolorParametricWallItemInput,
		onStatus: (status: RecolorParametricWallItemStatus) => void,
	): Promise<RecolorParametricWallItemUseCaseResult> {
		const updated = recolorParametricWallItem(
			base.project,
			input,
			this.dependencies.clock.now(),
		);
		if (updated.kind === "rejected") return updated;
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
		const publication = await this.dependencies.repository.publishNextRevision(
			candidate,
			base.revision.revisionId,
		);
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
}

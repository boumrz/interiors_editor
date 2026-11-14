import type {
	ProjectRevisionPublicationPort,
	PublicationFailureReason,
	V2PublicationCandidate,
} from "./ports";

export type V2ProjectMutationPublicationStatus =
	| { readonly kind: "saving" }
	| { readonly kind: "saved"; readonly candidate: V2PublicationCandidate }
	| {
			readonly candidate: V2PublicationCandidate;
			readonly kind: "stale-base";
			readonly reasonCode: "STALE_BASE_REVISION";
	  }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: PublicationFailureReason;
			readonly candidate: V2PublicationCandidate;
	  };

export type V2ProjectMutationPublicationResult =
	| {
			readonly kind: "durable";
			readonly projectId: string;
			readonly revisionId: string;
	  }
	| { readonly kind: "stale-base"; readonly reasonCode: "STALE_BASE_REVISION" }
	| {
			readonly kind: "persist-failed";
			readonly reasonCode: PublicationFailureReason;
	  };

/**
 * Legacy V2 fixtures are not a product route, but they must retain the same
 * exact-base publication invariant as every durable Project mutation.
 */
export async function publishV2ProjectMutation(
	candidate: V2PublicationCandidate,
	expectedBaseRevisionId: string,
	repository: ProjectRevisionPublicationPort<PublicationFailureReason>,
	onStatus: (status: V2ProjectMutationPublicationStatus) => void,
): Promise<V2ProjectMutationPublicationResult> {
	onStatus({ kind: "saving" });
	const publication = await repository.publishNextRevision(
		candidate,
		expectedBaseRevisionId,
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
		projectId: candidate.project.projectId,
		revisionId: candidate.revision.revisionId,
	};
}

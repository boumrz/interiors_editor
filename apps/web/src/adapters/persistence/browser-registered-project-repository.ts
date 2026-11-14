import { ScopedProjectRepository } from "./scoped-project-repository";
import type {
	ScopedProjectProtocol,
	ScopedProjectRepositoryDependencies,
} from "./scoped-project-protocol";
import type { BrowserRegisteredScopeStore } from "./browser-registered-scope-store";
import { decideBrowserRegisteredWriterLease } from "./browser-registered-writer-lease";

const browserProtocol: ScopedProjectProtocol = {
	assertNewRevisionIdentity: (transaction, candidate) =>
		new Promise<void>((resolve, reject) => {
			// Stream the retained journal rather than allocating all historic Project bytes.
			const operation = transaction
				.objectStore("publication-attempts")
				.openCursor();
			operation.onsuccess = () => {
				const cursor = operation.result;
				if (!cursor) {
					resolve();
					return;
				}
				const value: unknown = cursor.value;
				if (
					value !== null &&
					typeof value === "object" &&
					"projectId" in value &&
					"revisionId" in value &&
					value.projectId === candidate.project.projectId &&
					value.revisionId === candidate.revision.revisionId
				) {
					reject(
						new Error(
							"Browser Project and Revision identity was already reserved",
						),
					);
					return;
				}
				cursor.continue();
			};
			operation.onerror = () =>
				reject(
					operation.error ??
						new Error("Could not prove browser Revision identity"),
				);
		}),
	operationIdPrefix: (scope, kind) => {
		if (scope !== "browser-registered-v1")
			throw new Error("Invalid anonymous browser scope");
		return `browser-registered-v1:${kind}:`;
	},
	decideWriterLease: decideBrowserRegisteredWriterLease,
};

/** Separate actual browser storage with the unchanged shared publication kernel. */
export class BrowserRegisteredProjectRepository extends ScopedProjectRepository {
	public constructor(
		storage: BrowserRegisteredScopeStore,
		dependencies: ScopedProjectRepositoryDependencies,
	) {
		super(storage, dependencies, browserProtocol);
	}
}

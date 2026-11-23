import { ScopedProjectRepository } from "./scoped-project-repository";
import type {
	ScopedProjectProtocol,
	ScopedProjectRepositoryDependencies,
} from "./scoped-project-protocol";
import type { TelegramScopeStore } from "./telegram-scope-store";
import { decideTelegramWriterLease } from "./telegram-writer-lease";

const telegramProtocol: ScopedProjectProtocol = {
	async assertNewRevisionIdentity(transaction, candidate) {
		if (transaction.db.version !== 3 && candidate.project.assetInstances.some(
			(item) => item.anchorClass === "floor" && "yawMilliDeg" in item && item.yawMilliDeg !== undefined,
		)) {
			throw new Error("Exact floor yaw requires current Telegram storage");
		}
	},
	operationIdPrefix: (scope, kind) => `tma-v1:${scope}:${kind}:`,
	decideWriterLease: decideTelegramWriterLease,
	async readPinnedBlob(blob) {
		try {
			return await blob.arrayBuffer();
		} catch (error) {
			if (!(error instanceof DOMException) || error.name !== "NotReadableError") {
				throw error;
			}
			return blob.arrayBuffer();
		}
	},
};

/** Actual Telegram storage and strict writer identity remain host-owned dependencies. */
export class TelegramProjectRepository extends ScopedProjectRepository {
	public constructor(
		storage: TelegramScopeStore,
		dependencies: ScopedProjectRepositoryDependencies,
	) {
		super(storage, dependencies, telegramProtocol);
	}
}

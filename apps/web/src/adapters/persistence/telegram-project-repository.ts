import { projectUsesInteriorDetails } from "../../domain/interior-project-format";
import { ScopedProjectRepository } from "./scoped-project-repository";
import type {
	ScopedProjectProtocol,
	ScopedProjectRepositoryDependencies,
} from "./scoped-project-protocol";
import type { TelegramScopeStore } from "./telegram-scope-store";
import { decideTelegramWriterLease } from "./telegram-writer-lease";

const telegramProtocol: ScopedProjectProtocol = {
	async assertNewRevisionIdentity(transaction, candidate) {
		const version = transaction.db.version;
		const { project } = candidate;
		if (![2, 3, 4, 5, 6].includes(version)) throw new Error("Unknown Telegram storage version");
		if (project.schemaVersion !== 1) throw new Error("Unsupported Telegram Project schema");
		if (projectUsesInteriorDetails(project) && version !== 6)
			throw new Error("Room interior requires Telegram storage version 6");
		if (project.roomLayouts !== undefined && version < 5)
			throw new Error("Room layouts require current Telegram storage");
		if (version < 3 && project.assetInstances.some(
			(item) => item.anchorClass === "floor" && "yawMilliDeg" in item && item.yawMilliDeg !== undefined,
		)) {
			throw new Error("Exact floor yaw requires current Telegram storage");
		}
		if (version < 4 && project.level.openings.some((opening) => opening.hingeEnd === "end")) {
			throw new Error("Door hinges require current Telegram storage");
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
		allowTelegramExtendedSchemas = false,
	) {
		super(storage, dependencies, allowTelegramExtendedSchemas
			? { ...telegramProtocol, allowTelegramExtendedSchemas } : telegramProtocol);
	}
}

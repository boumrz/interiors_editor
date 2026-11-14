import { ScopedProjectRepository } from "./scoped-project-repository";
import type {
	ScopedProjectProtocol,
	ScopedProjectRepositoryDependencies,
} from "./scoped-project-protocol";
import type { TelegramScopeStore } from "./telegram-scope-store";
import { decideTelegramWriterLease } from "./telegram-writer-lease";

const telegramProtocol: ScopedProjectProtocol = {
	operationIdPrefix: (scope, kind) => `tma-v1:${scope}:${kind}:`,
	decideWriterLease: decideTelegramWriterLease,
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

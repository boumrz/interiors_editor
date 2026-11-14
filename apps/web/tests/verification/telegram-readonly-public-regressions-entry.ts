import "../browser/telegram-readonly-source-harness";
import { createTelegramReadonlyPublicCounter } from "../browser/telegram-readonly-public-regressions-harness";
import { verifiedReadonlyTestScope } from "../fixtures/telegram-readonly-signed-launch";
import { renamedReadonlyCounter } from "./telegram-readonly-counter-matrix";

window.__telegramReadonlyCounterMatrix = createTelegramReadonlyPublicCounter({
	indexedDb: indexedDB,
	databaseName: async () => `interiors-editor-projects:${await verifiedReadonlyTestScope()}`,
	rename: renamedReadonlyCounter,
});

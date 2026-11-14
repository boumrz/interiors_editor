import { decideScopedWriterLease } from "./scoped-writer-lease";
import type { ScopedWriterRequest } from "./scoped-project-protocol";

const browserProfile = {
	isScope: (scope: string) => scope === "browser-registered-v1",
	label: "Browser registered",
};

/** Anonymous browser profile never accepts a Telegram or file-selected identity. */
export function decideBrowserRegisteredWriterLease(
	request: ScopedWriterRequest,
	stored: unknown,
) {
	return decideScopedWriterLease(request, stored, browserProfile);
}

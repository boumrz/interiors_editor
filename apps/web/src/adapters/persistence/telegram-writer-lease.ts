import { decideScopedWriterLease } from "./scoped-writer-lease";
import type { ScopedWriterRequest } from "./scoped-project-protocol";
export type { ScopedWriterRecord as TelegramWriterRecord } from "./scoped-project-protocol";

const telegramProfile = {
	isScope: (scope: string) => /^tma-v1-[a-f0-9]{64}$/.test(scope),
	label: "Telegram",
};

/** Actual Telegram identity validation remains strict and host-owned. */
export function decideTelegramWriterLease(
	request: ScopedWriterRequest,
	stored: unknown,
) {
	return decideScopedWriterLease(request, stored, telegramProfile);
}

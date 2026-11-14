import type {
	ScopedWriterRecord,
	ScopedWriterRequest,
} from "./scoped-project-protocol";

/** Trusted host composition supplies identity validation; persisted/file data never selects it. */
interface ScopedWriterProfile {
	readonly isScope: (scope: string) => boolean;
	readonly label: string;
}

/** The caller must read, decide and persist inside one strict IDB transaction. */
export function decideScopedWriterLease(
	request: ScopedWriterRequest,
	stored: unknown,
	profile: ScopedWriterProfile,
):
	| { readonly kind: "acquired"; readonly writer: ScopedWriterRecord }
	| { readonly kind: "held-by-another-writer" } {
	const expiresAtEpochMs = request.nowEpochMs + request.durationMs;
	if (
		!profile.isScope(request.scope) ||
		!request.projectId ||
		!request.ownerId ||
		!Number.isSafeInteger(request.nowEpochMs) ||
		request.nowEpochMs < 0 ||
		!Number.isSafeInteger(request.durationMs) ||
		request.durationMs <= 0 ||
		!Number.isSafeInteger(expiresAtEpochMs)
	) {
		throw new Error(`Invalid ${profile.label} writer request`);
	}
	if (stored !== undefined && !isWriterRecord(stored, request)) {
		throw new Error(`${profile.label} writer metadata is corrupt`);
	}
	const current = stored as ScopedWriterRecord | undefined;
	if (current?.deleted)
		throw new Error(`${profile.label} Project was permanently deleted`);
	const active = current && current.expiresAtEpochMs > request.nowEpochMs;
	if (
		active &&
		current.ownerId !== request.ownerId &&
		!request.explicitTakeover
	) {
		return { kind: "held-by-another-writer" };
	}
	const renewing = active && !request.explicitTakeover;
	const fencingToken = renewing
		? current.fencingToken
		: (current?.fencingToken ?? 0) + 1;
	if (!Number.isSafeInteger(fencingToken)) {
		throw new Error(`${profile.label} writer generations are exhausted`);
	}
	return {
		kind: "acquired",
		writer: {
			scope: request.scope,
			projectId: request.projectId,
			ownerId: request.ownerId,
			fencingToken,
			expiresAtEpochMs: renewing
				? Math.max(current.expiresAtEpochMs, expiresAtEpochMs)
				: expiresAtEpochMs,
			deleted: false,
		},
	};
}

function isWriterRecord(
	value: unknown,
	request: ScopedWriterRequest,
): value is ScopedWriterRecord {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return (
		Object.keys(record).length === 6 &&
		record.scope === request.scope &&
		record.projectId === request.projectId &&
		typeof record.ownerId === "string" &&
		record.ownerId.length > 0 &&
		typeof record.fencingToken === "number" &&
		Number.isSafeInteger(record.fencingToken) &&
		record.fencingToken > 0 &&
		typeof record.expiresAtEpochMs === "number" &&
		Number.isSafeInteger(record.expiresAtEpochMs) &&
		record.expiresAtEpochMs >= 0 &&
		typeof record.deleted === "boolean"
	);
}

/**
 * Active Alpha ingress classification has exactly one registered selector.
 *
 * This is intentionally not a historical V1/V2 decoder or a migration seam.
 * Every non-selected input remains byte-preserved and is only labelled
 * `legacy-unreadable`; it cannot create a Project, pin resources, allocate an
 * ID, publish a Revision or enter RecoveryChangeSet processing.
 */

import {
	parsePpjA1JsonBytes,
	type LosslessJsonValue,
} from "./ppj-a1-lossless-json";

export type ActiveAlphaLegacyClassification =
	| {
			readonly kind: "current-ppj-a1";
			readonly originalBytes: readonly number[];
	  }
	| {
			readonly kind: "legacy-unreadable";
			readonly originalBytes: readonly number[];
	  };

const CURRENT_PROJECT_SCHEMA_ID = "interiors.project/alpha-1";
const CURRENT_SCHEMA_VERSION_LEXEME = "1";

/**
 * Parses bytes with the production PPJ-A1 raw parser and applies the closed
 * current-selector semantics. The returned source copy is frozen so callers
 * can only hand it on diagnostically; this boundary has no Project mutation
 * or durable-resource ports.
 */
export function classifyActiveAlphaProjectBytes(
	rawInputBytes: readonly number[],
): ActiveAlphaLegacyClassification {
	const originalBytes = Object.freeze([...rawInputBytes]);
	const parsed = parsePpjA1JsonBytes(Uint8Array.from(originalBytes));

	return isRegisteredCurrentPpjA1Selector(parsed)
		? { kind: "current-ppj-a1", originalBytes }
		: { kind: "legacy-unreadable", originalBytes };
}

function isRegisteredCurrentPpjA1Selector(
	parsed: ReturnType<typeof parsePpjA1JsonBytes>,
): boolean {
	if (parsed.kind !== "accepted" || parsed.root.kind !== "object") {
		return false;
	}
	const projectSchemaId = parsed.root.properties.get("projectSchemaId");
	const schemaVersion = parsed.root.properties.get("schemaVersion");
	return (
		isExactString(projectSchemaId, CURRENT_PROJECT_SCHEMA_ID) &&
		isExactNumberLexeme(schemaVersion, CURRENT_SCHEMA_VERSION_LEXEME)
	);
}

function isExactString(
	value: LosslessJsonValue | undefined,
	expected: string,
): boolean {
	return value?.kind === "string" && value.value === expected;
}

function isExactNumberLexeme(
	value: LosslessJsonValue | undefined,
	expected: string,
): boolean {
	return value?.kind === "number" && value.lexeme === expected;
}

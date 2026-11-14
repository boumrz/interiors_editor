/**
 * TCC-A1 corpus execution is a detached evidence seam. It validates manifest
 * declarations and compares a kernel result; it never creates a Project,
 * assigns durable IDs, writes history, or publishes a revision.
 *
 * The SHA-256 implementation is an injected adapter because the domain must
 * remain usable in both browser and test environments without choosing a
 * platform crypto runtime as topology authority.
 */

export const TCC_A1_CONTRACT_ID = "interiors.topology-corpus-contract";
export const TCC_A1_CONTRACT_VERSION = 1;

/**
 * A corpus executor is either the adopted detached domain kernel or an
 * equally detached source-owned byte classifier. Neither role receives a
 * durable Project/revision/store port.
 */
export type TccA1ExecutorRole = "domain-kernel" | "legacy-classifier";

/**
 * This list is an allow-list of source-owned reasons already emitted by the
 * active domain topology commands. It is intentionally not `string`: an
 * unreviewed fixture cannot invent a new public reason through corpus data.
 */
const TCC_A1_STABLE_REJECT_REASONS = [
	"AMBIGUOUS_BOUNDED_WALK",
	"COLLINEAR_OVERLAP",
	"DEGENERATE_WALL",
	"DIAGONAL_WALL_CONTACT_UNSUPPORTED",
	"EMPTY_PLAN",
	"INVALID_DIMENSION",
	"INVALID_PLAN_GRAPH",
	"INVALID_RESULTING_PLAN_GRAPH",
	"INVALID_RESULTING_PROJECT",
	"INVALID_ROOM_METADATA",
	"INVALID_SOURCE_PROJECT",
	"ITEM_HOST_UNRESOLVABLE",
	"NON_ORTHOGONAL_WALL",
	"OPENING_CONFLICT_STALE",
	"OPENING_HOST_UNRESOLVABLE",
	"PLAN_FACE_DERIVATION_REJECTED",
	"PROJECT_BOUNDS_EXCEEDED",
	"ROOM_FACE_RECONCILIATION_FAILED",
	"ROOM_HEIGHT_CONFLICT",
	"ROOM_METADATA_CONFLICT_STALE",
	"ROOM_USABLE_AREA_COLLAPSE",
	"TOO_SHORT_WALL",
	"UNRESOLVED_WALL_REFERENCE",
	"UNSUPPORTED_DIRECTION",
	"UNSUPPORTED_FACE_SHAPE",
	"UNSUPPORTED_WALL_THICKNESS",
	"USABLE_POLYGON_COLLAPSED",
	"VERTEX_NOT_DELETABLE",
	"VERTEX_NOT_FOUND",
	"VERTEX_NOT_MOVABLE",
	"VERTEX_POSITION_UNCHANGED",
	"WALL_ADD_CONFLICT_STALE",
	"WALL_DELETION_CONFLICT",
	"WALL_DELETION_CONFLICT_STALE",
	"WALL_DOOR_OPENING_COLLISION",
	"WALL_ITEM_COLLISION",
	"WALL_NOT_FOUND",
	"WALL_NOT_MOVABLE",
	"WALL_POSITION_UNCHANGED",
	"WALL_SPLIT_CONFLICT_STALE",
	"WALL_SPLIT_POINT_INVALID",
	"ZERO_LENGTH",
] as const;

export type TccA1StableGeometryRejectReason =
	(typeof TCC_A1_STABLE_REJECT_REASONS)[number];

export type TccA1AcceptedOutcome = {
	readonly allocationIntent: readonly string[];
	readonly inverseStateDigest: string;
	readonly kind: "accepted";
	/**
	 * These are fixture-only opaque candidate references. They let a corpus
	 * verify allocation intent without claiming a durable ID allocation.
	 */
	readonly opaqueCandidateRefs: readonly string[];
	readonly postStateDigest: string;
};

export type TccA1RejectedOutcome = {
	readonly allocationIntent: readonly [];
	readonly kind: "rejected";
	readonly postStateDigest: string;
	readonly reasonCode: TccA1StableGeometryRejectReason;
};

/**
 * A transient proves that the kernel deliberately produced no candidate. The
 * seed supports only AD-21's three materialization races; future selection or
 * conflict transients need their own adopted outcome contract.
 */
export type TccA1MaterializationTransientKind =
	| "awaiting-user-outcome"
	| "cancelled"
	| "conflict-preview"
	| "lost-fence"
	| "selection-unavailable"
	| "stale-base";

export type TccA1TransientOutcome = {
	/**
	 * Expected transient fixtures must declare no allocation.  The wider runtime
	 * shape intentionally lets the runner expose an executor that leaked a
	 * candidate allocation instead of allowing an adapter to erase that fact.
	 */
	readonly allocationIntent: readonly string[];
	readonly kind: "transient";
	readonly postStateDigest: string;
	readonly transientKind: TccA1MaterializationTransientKind;
};

/** TCC-A1 §4 labels: a result is evidence-only and cannot promote legacy bytes. */
export type TccA1LegacyClassifierResult =
	| "current-ppj-a1"
	| "legacy-assessment-eligible"
	| "legacy-unmappable"
	| "legacy-unreadable"
	| "legacy-v1-readable"
	| "legacy-v2-readable";

export type TccA1LegacyHandoff =
	| "assessment-only"
	| "current-ingress"
	| "ordinary-ingress-precedence"
	| "quarantine-diagnostic";

export type TccA1LegacyClassificationOutcome = {
	readonly allocationIntent: readonly [];
	readonly classifierResult: TccA1LegacyClassifierResult;
	readonly handoff: TccA1LegacyHandoff;
	readonly kind: "legacy-classification";
	readonly postStateDigest: string;
};

export type TccA1Outcome =
	| TccA1AcceptedOutcome
	| TccA1LegacyClassificationOutcome
	| TccA1RejectedOutcome
	| TccA1TransientOutcome;

export type TccA1CorpusFixture<Intent> = {
	readonly baseStateDigest: string;
	readonly expected: TccA1Outcome;
	readonly fixtureId: string;
	readonly intent: Intent;
	/** Exact immutable source bytes; runner copies them before every handoff. */
	readonly rawInputBytes: readonly number[];
	/** Lower-case SHA-256 hex over rawInputBytes. */
	readonly rawInputSha256: string;
};

export type TccA1CorpusManifest<Intent> = {
	readonly contractId: typeof TCC_A1_CONTRACT_ID;
	readonly contractVersion: typeof TCC_A1_CONTRACT_VERSION;
	readonly corpusId: string;
	readonly corpusRevision: number;
	readonly executorRole: TccA1ExecutorRole;
	readonly fixtures: readonly TccA1CorpusFixture<Intent>[];
	readonly policyReferences: readonly string[];
};

export type TccA1ExecutionInput<Intent> = {
	readonly baseStateDigest: string;
	readonly fixtureId: string;
	readonly intent: Intent;
	readonly rawInputBytes: readonly number[];
};

export type TccA1CorpusExecutor<Intent> = {
	evaluate(
		input: TccA1ExecutionInput<Intent>,
	): TccA1Outcome | Promise<TccA1Outcome>;
};

export type TccA1FixtureHashPort = {
	sha256(rawInputBytes: Uint8Array): Promise<string>;
};

export type TccA1CorpusInspectionViolation =
	| "INVALID_MANIFEST"
	| "INVALID_CONTRACT_ID"
	| "INVALID_CONTRACT_VERSION"
	| "INVALID_CORPUS_ID"
	| "INVALID_CORPUS_REVISION"
	| "INVALID_EXECUTOR_ROLE"
	| "MISSING_POLICY_REFERENCE"
	| "MISSING_FIXTURE"
	| `INVALID_POLICY_REFERENCE:${string}`
	| `INVALID_FIXTURE_ID:${string}`
	| `DUPLICATE_FIXTURE_ID:${string}`
	| `INVALID_RAW_INPUT_BYTES:${string}`
	| `INVALID_FIXTURE_SHA256:${string}`
	| `MISSING_SEMANTIC_INTENT:${string}`
	| `MISSING_EXPECTED_OUTCOME:${string}`
	| `INVALID_EXPECTED_OUTCOME:${string}`
	| `EXECUTOR_OUTCOME_ROLE_MISMATCH:${string}`
	| `ACCEPTED_INVERSE_MUST_RESTORE_BASE:${string}`;

export type TccA1CorpusRecord =
	| { readonly fixtureId: string; readonly kind: "matched" }
	| {
			readonly fixtureId: string;
			readonly kind: "mismatched";
			readonly reasonCode:
				| "OUTCOME_KIND_MISMATCH"
				| "POST_STATE_MISMATCH"
				| "ALLOCATION_INTENT_MISMATCH"
				| "OPAQUE_CANDIDATE_REFS_MISMATCH"
				| "INVERSE_STATE_MISMATCH"
				| "REJECTED_STATE_CHANGED"
				| "REJECTED_ALLOCATION_INTENT"
				| "REASON_CODE_MISMATCH"
				| "TRANSIENT_STATE_CHANGED"
				| "TRANSIENT_ALLOCATION_INTENT"
				| "TRANSIENT_KIND_MISMATCH"
				| "LEGACY_STATE_CHANGED"
				| "LEGACY_ALLOCATION_INTENT"
				| "LEGACY_CLASSIFICATION_MISMATCH"
				| "LEGACY_HANDOFF_MISMATCH"
				| "EXECUTOR_UNAVAILABLE";
	  };

export type TccA1CorpusRun =
	| { readonly kind: "invalid-corpus"; readonly violations: readonly string[] }
	| { readonly kind: "failed"; readonly records: readonly TccA1CorpusRecord[] }
	| { readonly kind: "passed"; readonly records: readonly TccA1CorpusRecord[] };

/**
 * Checks declaration shape only. SHA computation remains asynchronous and is
 * deliberately performed by runTccA1Corpus before an executor receives input.
 */
export function inspectTccA1CorpusManifest(
	manifest: unknown,
): readonly TccA1CorpusInspectionViolation[] {
	if (
		!isRecord(manifest) ||
		!Array.isArray(manifest.fixtures) ||
		!Array.isArray(manifest.policyReferences)
	) {
		return ["INVALID_MANIFEST"];
	}
	const violations: TccA1CorpusInspectionViolation[] = [];
	if (manifest.contractId !== TCC_A1_CONTRACT_ID) {
		violations.push("INVALID_CONTRACT_ID");
	}
	if (manifest.contractVersion !== TCC_A1_CONTRACT_VERSION) {
		violations.push("INVALID_CONTRACT_VERSION");
	}
	if (!isNonBlankText(manifest.corpusId)) {
		violations.push("INVALID_CORPUS_ID");
	}
	if (
		typeof manifest.corpusRevision !== "number" ||
		!Number.isSafeInteger(manifest.corpusRevision) ||
		manifest.corpusRevision <= 0
	) {
		violations.push("INVALID_CORPUS_REVISION");
	}
	if (!isExecutorRole(manifest.executorRole)) {
		violations.push("INVALID_EXECUTOR_ROLE");
	}
	inspectPolicyReferences(manifest.policyReferences, violations);
	inspectFixtures(manifest.fixtures, manifest.executorRole, violations);
	return violations;
}

/**
 * Hashes all source bytes before dispatching the first fixture. This prevents a
 * partially executed corpus from being reported when a later fixture has been
 * altered or was paired with the wrong SHA declaration.
 */
export async function runTccA1Corpus<Intent>(
	manifest: TccA1CorpusManifest<Intent>,
	executor: TccA1CorpusExecutor<Intent>,
	hashPort: TccA1FixtureHashPort,
): Promise<TccA1CorpusRun> {
	const declarationViolations = inspectTccA1CorpusManifest(manifest);
	if (declarationViolations.length > 0) {
		return { kind: "invalid-corpus", violations: declarationViolations };
	}
	// Snapshot before the first await. Hashing, execution and expected-outcome
	// comparison must all observe exactly the same immutable fixture values.
	const validatedManifest = snapshotManifest(manifest);

	const hashViolations = await inspectFixtureHashes(
		validatedManifest.fixtures,
		hashPort,
	);
	if (hashViolations.length > 0) {
		return { kind: "invalid-corpus", violations: hashViolations };
	}

	const records: TccA1CorpusRecord[] = [];
	for (const fixture of validatedManifest.fixtures) {
		try {
			records.push(
				inspectOutcome(
					fixture,
					await executor.evaluate(toExecutionInput(fixture)),
				),
			);
		} catch {
			records.push(mismatch(fixture.fixtureId, "EXECUTOR_UNAVAILABLE"));
		}
	}
	return records.every((record) => record.kind === "matched")
		? { kind: "passed", records }
		: { kind: "failed", records };
}

function inspectPolicyReferences(
	policyReferences: unknown,
	violations: TccA1CorpusInspectionViolation[],
): void {
	if (!Array.isArray(policyReferences) || policyReferences.length === 0) {
		violations.push("MISSING_POLICY_REFERENCE");
		return;
	}
	for (const policyReference of policyReferences) {
		if (!isNonBlankText(policyReference)) {
			violations.push(`INVALID_POLICY_REFERENCE:${String(policyReference)}`);
		}
	}
}

function inspectFixtures(
	fixtures: readonly unknown[],
	executorRole: unknown,
	violations: TccA1CorpusInspectionViolation[],
): void {
	if (fixtures.length === 0) {
		violations.push("MISSING_FIXTURE");
		return;
	}
	const fixtureIds = new Set<string>();
	for (const fixture of fixtures) {
		if (!isRecord(fixture)) {
			violations.push("INVALID_MANIFEST");
			continue;
		}
		const declaredFixtureId = fixture.fixtureId;
		const fixtureId = isNonBlankText(declaredFixtureId)
			? declaredFixtureId
			: String(declaredFixtureId);
		if (!isNonBlankText(declaredFixtureId)) {
			violations.push(`INVALID_FIXTURE_ID:${fixtureId}`);
		} else if (fixtureIds.has(declaredFixtureId)) {
			violations.push(`DUPLICATE_FIXTURE_ID:${declaredFixtureId}`);
		}
		fixtureIds.add(fixtureId);

		if (!isByteSequence(fixture.rawInputBytes)) {
			violations.push(`INVALID_RAW_INPUT_BYTES:${fixtureId}`);
		}
		if (!isSha256Hex(fixture.rawInputSha256)) {
			violations.push(`INVALID_FIXTURE_SHA256:${fixtureId}`);
		}
		if (fixture.intent === undefined) {
			violations.push(`MISSING_SEMANTIC_INTENT:${fixtureId}`);
		}
		if (fixture.expected === undefined) {
			violations.push(`MISSING_EXPECTED_OUTCOME:${fixtureId}`);
		} else if (!isOutcome(fixture.expected, fixture.baseStateDigest)) {
			violations.push(`INVALID_EXPECTED_OUTCOME:${fixtureId}`);
		} else if (
			isExecutorRole(executorRole) &&
			!isExecutorOutcomeRoleCompatible(executorRole, fixture.expected)
		) {
			violations.push(`EXECUTOR_OUTCOME_ROLE_MISMATCH:${fixtureId}`);
		} else if (
			fixture.expected.kind === "accepted" &&
			fixture.expected.inverseStateDigest !== fixture.baseStateDigest
		) {
			violations.push(`ACCEPTED_INVERSE_MUST_RESTORE_BASE:${fixtureId}`);
		}
	}
}

function snapshotManifest<Intent>(
	manifest: TccA1CorpusManifest<Intent>,
): TccA1CorpusManifest<Intent> {
	return Object.freeze({
		contractId: manifest.contractId,
		contractVersion: manifest.contractVersion,
		corpusId: manifest.corpusId,
		corpusRevision: manifest.corpusRevision,
		executorRole: manifest.executorRole,
		fixtures: Object.freeze(
			manifest.fixtures.map((fixture) =>
				Object.freeze({
					baseStateDigest: fixture.baseStateDigest,
					expected: snapshotOutcome(fixture.expected),
					fixtureId: fixture.fixtureId,
					intent: cloneAndFreeze(fixture.intent),
					rawInputBytes: Object.freeze([...fixture.rawInputBytes]),
					rawInputSha256: fixture.rawInputSha256,
				}),
			),
		),
		policyReferences: Object.freeze([...manifest.policyReferences]),
	});
}

function snapshotOutcome(outcome: TccA1Outcome): TccA1Outcome {
	return outcome.kind === "accepted"
		? Object.freeze({
				allocationIntent: Object.freeze([...outcome.allocationIntent]),
				inverseStateDigest: outcome.inverseStateDigest,
				kind: "accepted" as const,
				opaqueCandidateRefs: Object.freeze([...outcome.opaqueCandidateRefs]),
				postStateDigest: outcome.postStateDigest,
			})
		: outcome.kind === "rejected"
			? Object.freeze({
					allocationIntent: [] as const,
					kind: "rejected" as const,
					postStateDigest: outcome.postStateDigest,
					reasonCode: outcome.reasonCode,
				})
			: outcome.kind === "transient"
				? Object.freeze({
						allocationIntent: Object.freeze([...outcome.allocationIntent]),
						kind: "transient" as const,
						postStateDigest: outcome.postStateDigest,
						transientKind: outcome.transientKind,
					})
				: Object.freeze({
						allocationIntent: [] as const,
						classifierResult: outcome.classifierResult,
						handoff: outcome.handoff,
						kind: "legacy-classification" as const,
						postStateDigest: outcome.postStateDigest,
					});
}

async function inspectFixtureHashes<Intent>(
	fixtures: readonly TccA1CorpusFixture<Intent>[],
	hashPort: TccA1FixtureHashPort,
): Promise<
	readonly (
		| `FIXTURE_SHA256_MISMATCH:${string}`
		| `FIXTURE_SHA256_UNAVAILABLE:${string}`
	)[]
> {
	const digests = await Promise.all(
		fixtures.map(async (fixture) => {
			try {
				return {
					actual: await hashPort.sha256(Uint8Array.from(fixture.rawInputBytes)),
					fixture,
					kind: "hashed" as const,
				};
			} catch {
				return { fixture, kind: "unavailable" as const };
			}
		}),
	);
	return digests.flatMap((result) => {
		if (result.kind === "unavailable") {
			return [
				`FIXTURE_SHA256_UNAVAILABLE:${result.fixture.fixtureId}` as const,
			];
		}
		return result.actual === result.fixture.rawInputSha256
			? []
			: [`FIXTURE_SHA256_MISMATCH:${result.fixture.fixtureId}` as const];
	});
}

function inspectOutcome<Intent>(
	fixture: TccA1CorpusFixture<Intent>,
	observed: TccA1Outcome,
): TccA1CorpusRecord {
	const expected = fixture.expected;
	if (expected.kind === "accepted") {
		if (observed.kind !== "accepted") {
			return mismatch(fixture.fixtureId, "OUTCOME_KIND_MISMATCH");
		}
		if (observed.postStateDigest !== expected.postStateDigest) {
			return mismatch(fixture.fixtureId, "POST_STATE_MISMATCH");
		}
		if (!sameSequence(observed.allocationIntent, expected.allocationIntent)) {
			return mismatch(fixture.fixtureId, "ALLOCATION_INTENT_MISMATCH");
		}
		if (
			!sameSequence(observed.opaqueCandidateRefs, expected.opaqueCandidateRefs)
		) {
			return mismatch(fixture.fixtureId, "OPAQUE_CANDIDATE_REFS_MISMATCH");
		}
		return observed.inverseStateDigest === expected.inverseStateDigest
			? { fixtureId: fixture.fixtureId, kind: "matched" }
			: mismatch(fixture.fixtureId, "INVERSE_STATE_MISMATCH");
	}

	if (expected.kind === "rejected") {
		if (observed.kind !== "rejected") {
			return mismatch(fixture.fixtureId, "OUTCOME_KIND_MISMATCH");
		}
		if (observed.postStateDigest !== fixture.baseStateDigest) {
			return mismatch(fixture.fixtureId, "REJECTED_STATE_CHANGED");
		}
		if (observed.allocationIntent.length !== 0) {
			return mismatch(fixture.fixtureId, "REJECTED_ALLOCATION_INTENT");
		}
		return observed.reasonCode === expected.reasonCode
			? { fixtureId: fixture.fixtureId, kind: "matched" }
			: mismatch(fixture.fixtureId, "REASON_CODE_MISMATCH");
	}

	if (expected.kind === "legacy-classification") {
		if (observed.kind !== "legacy-classification") {
			return mismatch(fixture.fixtureId, "OUTCOME_KIND_MISMATCH");
		}
		if (observed.postStateDigest !== fixture.baseStateDigest) {
			return mismatch(fixture.fixtureId, "LEGACY_STATE_CHANGED");
		}
		if (observed.allocationIntent.length !== 0) {
			return mismatch(fixture.fixtureId, "LEGACY_ALLOCATION_INTENT");
		}
		if (observed.classifierResult !== expected.classifierResult) {
			return mismatch(fixture.fixtureId, "LEGACY_CLASSIFICATION_MISMATCH");
		}
		return observed.handoff === expected.handoff
			? { fixtureId: fixture.fixtureId, kind: "matched" }
			: mismatch(fixture.fixtureId, "LEGACY_HANDOFF_MISMATCH");
	}

	if (observed.kind !== "transient") {
		return mismatch(fixture.fixtureId, "OUTCOME_KIND_MISMATCH");
	}
	if (observed.postStateDigest !== fixture.baseStateDigest) {
		return mismatch(fixture.fixtureId, "TRANSIENT_STATE_CHANGED");
	}
	if (observed.allocationIntent.length !== 0) {
		return mismatch(fixture.fixtureId, "TRANSIENT_ALLOCATION_INTENT");
	}
	return observed.transientKind === expected.transientKind
		? { fixtureId: fixture.fixtureId, kind: "matched" }
		: mismatch(fixture.fixtureId, "TRANSIENT_KIND_MISMATCH");
}

function toExecutionInput<Intent>(
	fixture: TccA1CorpusFixture<Intent>,
): TccA1ExecutionInput<Intent> {
	return Object.freeze({
		baseStateDigest: fixture.baseStateDigest,
		fixtureId: fixture.fixtureId,
		intent: cloneAndFreeze(fixture.intent),
		rawInputBytes: Object.freeze([...fixture.rawInputBytes]),
	});
}

function cloneAndFreeze<Value>(value: Value): Value {
	if (value === null || typeof value !== "object") {
		return value;
	}
	if (Array.isArray(value)) {
		return Object.freeze(value.map((entry) => cloneAndFreeze(entry))) as Value;
	}
	const copy: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		Object.defineProperty(copy, key, {
			configurable: false,
			enumerable: true,
			value: cloneAndFreeze(entry),
			writable: false,
		});
	}
	return Object.freeze(copy) as Value;
}

function mismatch(
	fixtureId: string,
	reasonCode: Extract<
		TccA1CorpusRecord,
		{ readonly kind: "mismatched" }
	>["reasonCode"],
): TccA1CorpusRecord {
	return { fixtureId, kind: "mismatched", reasonCode };
}

function isExecutorRole(value: unknown): value is TccA1ExecutorRole {
	return value === "domain-kernel" || value === "legacy-classifier";
}

function isExecutorOutcomeRoleCompatible(
	executorRole: TccA1ExecutorRole,
	outcome: TccA1Outcome,
): boolean {
	return executorRole === "legacy-classifier"
		? outcome.kind === "legacy-classification"
		: outcome.kind !== "legacy-classification";
}

function isNonBlankText(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isByteSequence(value: unknown): value is readonly number[] {
	return (
		Array.isArray(value) &&
		value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
	);
}

function isSha256Hex(value: unknown): value is string {
	return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isOutcome(
	value: unknown,
	baseStateDigest: unknown,
): value is TccA1Outcome {
	if (!isRecord(value) || !isNonBlankText(baseStateDigest)) {
		return false;
	}
	if (value.kind === "accepted") {
		return (
			isNonBlankText(value.postStateDigest) &&
			isNonBlankText(value.inverseStateDigest) &&
			isDistinctTextSequence(value.allocationIntent) &&
			isDistinctTextSequence(value.opaqueCandidateRefs)
		);
	}
	if (value.kind === "rejected") {
		return (
			value.postStateDigest === baseStateDigest &&
			Array.isArray(value.allocationIntent) &&
			value.allocationIntent.length === 0 &&
			isStableGeometryRejectReason(value.reasonCode)
		);
	}
	if (value.kind === "legacy-classification") {
		return (
			value.postStateDigest === baseStateDigest &&
			Array.isArray(value.allocationIntent) &&
			value.allocationIntent.length === 0 &&
			isLegacyClassifierResult(value.classifierResult) &&
			isLegacyHandoff(value.handoff)
		);
	}
	return (
		value.kind === "transient" &&
		value.postStateDigest === baseStateDigest &&
		Array.isArray(value.allocationIntent) &&
		value.allocationIntent.length === 0 &&
		isMaterializationTransientKind(value.transientKind)
	);
}

function isStableGeometryRejectReason(
	value: unknown,
): value is TccA1StableGeometryRejectReason {
	return (
		typeof value === "string" &&
		TCC_A1_STABLE_REJECT_REASONS.includes(
			value as TccA1StableGeometryRejectReason,
		)
	);
}

function isMaterializationTransientKind(
	value: unknown,
): value is TccA1MaterializationTransientKind {
	return (
		value === "awaiting-user-outcome" ||
		value === "cancelled" ||
		value === "conflict-preview" ||
		value === "lost-fence" ||
		value === "selection-unavailable" ||
		value === "stale-base"
	);
}

function isLegacyClassifierResult(
	value: unknown,
): value is TccA1LegacyClassifierResult {
	return (
		value === "current-ppj-a1" ||
		value === "legacy-assessment-eligible" ||
		value === "legacy-unmappable" ||
		value === "legacy-unreadable" ||
		value === "legacy-v1-readable" ||
		value === "legacy-v2-readable"
	);
}

function isLegacyHandoff(value: unknown): value is TccA1LegacyHandoff {
	return (
		value === "assessment-only" ||
		value === "current-ingress" ||
		value === "ordinary-ingress-precedence" ||
		value === "quarantine-diagnostic"
	);
}

function isDistinctTextSequence(value: unknown): value is readonly string[] {
	return (
		Array.isArray(value) &&
		value.every(isNonBlankText) &&
		new Set(value).size === value.length
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function sameSequence(
	first: readonly string[],
	second: readonly string[],
): boolean {
	return (
		first.length === second.length &&
		first.every((value, index) => value === second[index])
	);
}

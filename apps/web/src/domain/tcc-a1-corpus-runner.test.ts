import { describe, expect, it } from "@rstest/core";

import {
	inspectTccA1CorpusManifest,
	runTccA1Corpus,
	type TccA1CorpusExecutor,
	type TccA1CorpusManifest,
	type TccA1FixtureHashPort,
	type TccA1Outcome,
} from "./tcc-a1-corpus-runner";
import { initialEmptyPlanGraphWallTccA1Corpus } from "./initial-empty-plan-graph-wall-tcc-a1-corpus";
import {
	EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
	emptyPlanGraphWallCorpusExecutor,
} from "./empty-plan-graph-wall-candidate";
import {
	adaptInitialWallMaterializationResultToTccA1Outcome,
	createInitialWallMaterializationTccA1Executor,
	initialWallMaterializationTccA1Corpus,
} from "./initial-wall-materialization-tcc-a1-corpus";
import type { ContentHashPort } from "./materialize-initial-wall-segment";

type FixtureIntent = {
	readonly kind: "fixture-wall";
	readonly labels: readonly string[];
	readonly raw: {
		readonly end: { readonly xMm: string; readonly zMm: string };
		readonly start: { readonly xMm: string; readonly zMm: string };
	};
};

const expectedFixtureHash = "a".repeat(64);
const fixtureBytes = Object.freeze([0x7b, 0x7d]);

const acceptedOutcome: TccA1Outcome = {
	allocationIntent: ["vertex:start", "vertex:end", "wall:initial"],
	inverseStateDigest: "plan:empty",
	kind: "accepted",
	opaqueCandidateRefs: [
		"candidate:vertex:start",
		"candidate:vertex:end",
		"candidate:wall:initial",
	],
	postStateDigest: "plan:one-wall",
};

const manifest: TccA1CorpusManifest<FixtureIntent> = {
	contractId: "interiors.topology-corpus-contract",
	contractVersion: 1,
	corpusId: "interiors.tcc-a1.runner-test",
	corpusRevision: 1,
	executorRole: "domain-kernel",
	fixtures: [
		{
			baseStateDigest: "plan:empty",
			expected: acceptedOutcome,
			fixtureId: "TCC-A1-RUNNER-001",
			intent: {
				kind: "fixture-wall",
				labels: ["initial"],
				raw: {
					end: { xMm: "1000", zMm: "1000" },
					start: { xMm: "0", zMm: "0" },
				},
			},
			rawInputBytes: fixtureBytes,
			rawInputSha256: expectedFixtureHash,
		},
	],
	policyReferences: [
		"geometry-contract.md#raw-ingress-and-directions",
		"topology-corpus-contract.md#fixture-outcome-contract",
	],
};

const matchingHashPort: TccA1FixtureHashPort = {
	sha256: async () => expectedFixtureHash,
};

const webCryptoHashPort: TccA1FixtureHashPort = {
	sha256: async (bytes) => {
		const digest = await (
			globalThis as unknown as {
				crypto: {
					subtle: {
						digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
					};
				};
			}
		).crypto.subtle.digest("SHA-256", bytes);
		return [...new Uint8Array(digest)]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
	},
};

const matchingExecutor: TccA1CorpusExecutor<FixtureIntent> = {
	evaluate: () => acceptedOutcome,
};

/**
 * RED evidence for the complete TCC-A1 outcome vocabulary.  These tests are
 * deliberately expressed through the public corpus runner: a classifier or
 * a preview transient must be observable as a no-effect outcome, not hidden
 * behind an executor-specific escape hatch.
 */
const completeOutcomeManifest = {
	contractId: "interiors.topology-corpus-contract",
	contractVersion: 1,
	corpusId: "interiors.tcc-a1.complete-outcome-vocabulary",
	corpusRevision: 1,
	executorRole: "legacy-classifier",
	fixtures: [
		{
			baseStateDigest: "legacy:unchanged",
			expected: {
				allocationIntent: [],
				classifierResult: "legacy-v1-readable",
				handoff: "quarantine-diagnostic",
				kind: "legacy-classification",
				postStateDigest: "legacy:unchanged",
			},
			fixtureId: "TCC-A1-LEGACY-OUTCOME-001",
			intent: { kind: "classify-legacy-bytes" },
			rawInputBytes: fixtureBytes,
			rawInputSha256: expectedFixtureHash,
		},
	],
	policyReferences: [
		"topology-corpus-contract.md#4-v1v2-classification-migration-and-recovery-matrix",
	],
} as const;

describe("TCC-A1 corpus runner", () => {
	it("executes a legacy-classifier fixture as an immutable no-effect outcome", async () => {
		const legacyManifest =
			completeOutcomeManifest as unknown as TccA1CorpusManifest<{
				readonly kind: string;
			}>;
		const legacyOutcome = legacyManifest.fixtures[0]?.expected;
		if (!legacyOutcome) throw new Error("Expected immutable legacy fixture");

		expect(inspectTccA1CorpusManifest(completeOutcomeManifest)).toEqual([]);
		await expect(
			runTccA1Corpus(
				legacyManifest,
				{ evaluate: () => legacyOutcome },
				matchingHashPort,
			),
		).resolves.toEqual({
			kind: "passed",
			records: [{ fixtureId: "TCC-A1-LEGACY-OUTCOME-001", kind: "matched" }],
		});
	});

	it("accepts an adopted contact rejection and a conflict preview transient without weakening no-effect checks", async () => {
		const contactManifest = {
			...manifest,
			fixtures: [
				{
					...manifest.fixtures[0],
					expected: {
						allocationIntent: [],
						kind: "rejected",
						postStateDigest: "plan:empty",
						reasonCode: "COLLINEAR_OVERLAP",
					},
				},
			],
		} as unknown as TccA1CorpusManifest<FixtureIntent>;
		const transientManifest = {
			...manifest,
			fixtures: [
				{
					...manifest.fixtures[0],
					expected: {
						allocationIntent: [],
						kind: "transient",
						postStateDigest: "plan:empty",
						transientKind: "conflict-preview",
					},
				},
			],
		} as unknown as TccA1CorpusManifest<FixtureIntent>;
		const contactFixture = contactManifest.fixtures[0];
		const transientFixture = transientManifest.fixtures[0];
		if (!contactFixture || !transientFixture)
			throw new Error("Expected complete TCC-A1 fixtures");

		expect(inspectTccA1CorpusManifest(contactManifest)).toEqual([]);
		await expect(
			runTccA1Corpus(
				contactManifest,
				{
					evaluate: () => contactFixture.expected,
				},
				matchingHashPort,
			),
		).resolves.toMatchObject({ kind: "passed" });

		expect(inspectTccA1CorpusManifest(transientManifest)).toEqual([]);
		await expect(
			runTccA1Corpus(
				transientManifest,
				{
					evaluate: () => transientFixture.expected,
				},
				matchingHashPort,
			),
		).resolves.toMatchObject({ kind: "passed" });
	});

	it.each([
		[
			"wrong contract id",
			{ ...manifest, contractId: "other-contract" },
			["INVALID_CONTRACT_ID"],
		],
		[
			"wrong contract version",
			{ ...manifest, contractVersion: 2 },
			["INVALID_CONTRACT_VERSION"],
		],
		[
			"blank corpus id",
			{ ...manifest, corpusId: "   " },
			["INVALID_CORPUS_ID"],
		],
		[
			"zero corpus revision",
			{ ...manifest, corpusRevision: 0 },
			["INVALID_CORPUS_REVISION"],
		],
		[
			"fractional corpus revision",
			{ ...manifest, corpusRevision: 1.5 },
			["INVALID_CORPUS_REVISION"],
		],
		[
			"non-numeric corpus revision",
			{ ...manifest, corpusRevision: "1" },
			["INVALID_CORPUS_REVISION"],
		],
		[
			"unknown executor role",
			{ ...manifest, executorRole: "renderer" },
			["INVALID_EXECUTOR_ROLE"],
		],
		[
			"a blank policy reference",
			{ ...manifest, policyReferences: [""] },
			["INVALID_POLICY_REFERENCE:"],
		],
		[
			"a non-text policy reference",
			{ ...manifest, policyReferences: [7] },
			["INVALID_POLICY_REFERENCE:7"],
		],
		["no fixture", { ...manifest, fixtures: [] }, ["MISSING_FIXTURE"]],
		[
			"a non-record fixture",
			{ ...manifest, fixtures: [null] },
			["INVALID_MANIFEST"],
		],
		[
			"a malformed fixture id",
			{ ...manifest, fixtures: [{ ...manifest.fixtures[0], fixtureId: "" }] },
			["INVALID_FIXTURE_ID:"],
		],
		[
			"out-of-range raw source bytes",
			{
				...manifest,
				fixtures: [{ ...manifest.fixtures[0], rawInputBytes: [256] }],
			},
			["INVALID_RAW_INPUT_BYTES:TCC-A1-RUNNER-001"],
		],
		[
			"a mixed raw source byte sequence",
			{
				...manifest,
				fixtures: [{ ...manifest.fixtures[0], rawInputBytes: [0, -1, 255] }],
			},
			["INVALID_RAW_INPUT_BYTES:TCC-A1-RUNNER-001"],
		],
		[
			"a null expected outcome",
			{ ...manifest, fixtures: [{ ...manifest.fixtures[0], expected: null }] },
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"non-lowercase SHA declaration",
			{
				...manifest,
				fixtures: [{ ...manifest.fixtures[0], rawInputSha256: "A".repeat(64) }],
			},
			["INVALID_FIXTURE_SHA256:TCC-A1-RUNNER-001"],
		],
		[
			"an overlong SHA declaration",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						rawInputSha256: `${expectedFixtureHash}0`,
					},
				],
			},
			["INVALID_FIXTURE_SHA256:TCC-A1-RUNNER-001"],
		],
		[
			"missing semantic intent",
			{
				...manifest,
				fixtures: [{ ...manifest.fixtures[0], intent: undefined }],
			},
			["MISSING_SEMANTIC_INTENT:TCC-A1-RUNNER-001"],
		],
		[
			"missing expected outcome",
			{
				...manifest,
				fixtures: [{ ...manifest.fixtures[0], expected: undefined }],
			},
			["MISSING_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"an invalid accepted allocation label",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: { ...acceptedOutcome, allocationIntent: [""] },
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"a missing accepted post-state digest",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: { ...acceptedOutcome, postStateDigest: "" },
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"a missing accepted inverse digest",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: { ...acceptedOutcome, inverseStateDigest: "" },
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"duplicate accepted opaque references",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: {
							...acceptedOutcome,
							opaqueCandidateRefs: [
								"candidate:duplicate",
								"candidate:duplicate",
							],
						},
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"an invalid rejected declaration",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: {
							allocationIntent: ["forbidden"],
							kind: "rejected",
							postStateDigest: "plan:empty",
							reasonCode: "INVALID_DIMENSION",
						},
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"an unknown rejected reason",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: {
							allocationIntent: [],
							kind: "rejected",
							postStateDigest: "plan:empty",
							reasonCode: "UNKNOWN",
						},
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"a transient declaration that changes its base state",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: {
							allocationIntent: [],
							kind: "transient",
							postStateDigest: "changed-base",
							transientKind: "cancelled",
						},
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"a transient declaration that exposes allocation",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: {
							allocationIntent: ["leaked-id"],
							kind: "transient",
							postStateDigest: "plan:empty",
							transientKind: "cancelled",
						},
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
		[
			"a transient declaration with an unknown lifecycle state",
			{
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: {
							allocationIntent: [],
							kind: "transient",
							postStateDigest: "plan:empty",
							transientKind: "unknown",
						},
					},
				],
			},
			["INVALID_EXPECTED_OUTCOME:TCC-A1-RUNNER-001"],
		],
	] as const)(
		"rejects a manifest declaration with %s",
		(_caseName, candidate, expectedViolations) => {
			expect(inspectTccA1CorpusManifest(candidate)).toEqual(expectedViolations);
		},
	);

	it("binds every manifest executor role to its declared outcome authority", () => {
		expect(
			inspectTccA1CorpusManifest({
				...manifest,
				executorRole: "domain-kernel",
			}),
		).toEqual([]);
		expect(
			inspectTccA1CorpusManifest({
				...manifest,
				executorRole: "test-only-oracle",
			}),
		).toEqual(["INVALID_EXECUTOR_ROLE"]);
		expect(
			inspectTccA1CorpusManifest({
				...manifest,
				executorRole: "legacy-classifier",
			}),
		).toEqual(["EXECUTOR_OUTCOME_ROLE_MISMATCH:TCC-A1-RUNNER-001"]);
	});

	it("keeps active legacy fixtures no-effect and rejects their use by a domain executor", () => {
		const activeLegacyFixture = {
			...completeOutcomeManifest.fixtures[0],
			expected: {
				...completeOutcomeManifest.fixtures[0].expected,
				classifierResult: "current-ppj-a1",
				handoff: "current-ingress",
			},
		};
		const activeLegacyManifest = {
			...completeOutcomeManifest,
			fixtures: [activeLegacyFixture],
		};

		expect(inspectTccA1CorpusManifest(activeLegacyManifest)).toEqual([]);
		expect(
			inspectTccA1CorpusManifest({
				...activeLegacyManifest,
				executorRole: "domain-kernel",
			}),
		).toEqual([
			"EXECUTOR_OUTCOME_ROLE_MISMATCH:TCC-A1-LEGACY-OUTCOME-001",
		]);

		expect(
			inspectTccA1CorpusManifest({
				...activeLegacyManifest,
				fixtures: [
					{
						...activeLegacyFixture,
						expected: {
							...activeLegacyFixture.expected,
							postStateDigest: "legacy:changed",
						},
					},
				],
			}),
		).toEqual(["INVALID_EXPECTED_OUTCOME:TCC-A1-LEGACY-OUTCOME-001"]);
		expect(
			inspectTccA1CorpusManifest({
				...activeLegacyManifest,
				fixtures: [
					{
						...activeLegacyFixture,
						expected: {
							...activeLegacyFixture.expected,
							allocationIntent: ["forbidden"],
						},
					},
				],
			}),
		).toEqual(["INVALID_EXPECTED_OUTCOME:TCC-A1-LEGACY-OUTCOME-001"]);
		expect(
			inspectTccA1CorpusManifest({
				...activeLegacyManifest,
				fixtures: [
					{
						...activeLegacyFixture,
						expected: {
							...activeLegacyFixture.expected,
							classifierResult: "unregistered-result",
						},
					},
				],
			}),
		).toEqual(["INVALID_EXPECTED_OUTCOME:TCC-A1-LEGACY-OUTCOME-001"]);
		expect(
			inspectTccA1CorpusManifest({
				...activeLegacyManifest,
				fixtures: [
					{
						...activeLegacyFixture,
						expected: {
							...activeLegacyFixture.expected,
							handoff: "unregistered-handoff",
						},
					},
				],
			}),
		).toEqual(["INVALID_EXPECTED_OUTCOME:TCC-A1-LEGACY-OUTCOME-001"]);
	});

	it("accepts raw bytes at both inclusive byte boundaries", () => {
		expect(
			inspectTccA1CorpusManifest({
				...manifest,
				fixtures: [{ ...manifest.fixtures[0], rawInputBytes: [0, 255] }],
			}),
		).toEqual([]);
	});

	it("treats an untyped null manifest as a declaration failure rather than throwing or invoking an executor", async () => {
		const inspectFromUntypedBoundary = (value: unknown): unknown =>
			Reflect.apply(inspectTccA1CorpusManifest, undefined, [value]);
		const calls: unknown[] = [];

		expect(inspectFromUntypedBoundary(null)).toEqual(["INVALID_MANIFEST"]);
		await expect(
			Reflect.apply(runTccA1Corpus, undefined, [
				null,
				{
					evaluate: (input: unknown) => {
						calls.push(input);
						return acceptedOutcome;
					},
				},
				matchingHashPort,
			]),
		).resolves.toEqual({
			kind: "invalid-corpus",
			violations: ["INVALID_MANIFEST"],
		});
		expect(calls).toEqual([]);
	});

	it("rejects an accepted fixture declaration whose inverse cannot restore the declared base", async () => {
		const invalidInverseManifest = {
			...manifest,
			fixtures: [
				{
					...manifest.fixtures[0],
					expected: {
						...acceptedOutcome,
						inverseStateDigest: "plan:not-the-base",
					},
				},
			],
		};
		const calls: unknown[] = [];

		expect(inspectTccA1CorpusManifest(invalidInverseManifest)).toEqual([
			"ACCEPTED_INVERSE_MUST_RESTORE_BASE:TCC-A1-RUNNER-001",
		]);
		await expect(
			runTccA1Corpus(
				invalidInverseManifest,
				{
					evaluate: (input) => {
						calls.push(input);
						return acceptedOutcome;
					},
				},
				matchingHashPort,
			),
		).resolves.toEqual({
			kind: "invalid-corpus",
			violations: ["ACCEPTED_INVERSE_MUST_RESTORE_BASE:TCC-A1-RUNNER-001"],
		});
		expect(calls).toEqual([]);
	});

	it("rejects an incomplete or duplicate manifest before invoking an executor", async () => {
		const malformed = {
			...manifest,
			fixtures: [
				...manifest.fixtures,
				{ ...manifest.fixtures[0], fixtureId: "TCC-A1-RUNNER-001" },
			],
			policyReferences: [],
		};
		const calls: unknown[] = [];

		expect(inspectTccA1CorpusManifest(malformed)).toEqual([
			"MISSING_POLICY_REFERENCE",
			"DUPLICATE_FIXTURE_ID:TCC-A1-RUNNER-001",
		]);
		await expect(
			runTccA1Corpus(
				malformed,
				{
					evaluate: (input) => {
						calls.push(input);
						return acceptedOutcome;
					},
				},
				matchingHashPort,
			),
		).resolves.toEqual({
			kind: "invalid-corpus",
			violations: [
				"MISSING_POLICY_REFERENCE",
				"DUPLICATE_FIXTURE_ID:TCC-A1-RUNNER-001",
			],
		});
		expect(calls).toEqual([]);
	});

	it("checks every declared raw-input SHA-256 before executing any fixture", async () => {
		const calls: unknown[] = [];

		await expect(
			runTccA1Corpus(
				{
					...manifest,
					fixtures: [
						manifest.fixtures[0],
						{
							...manifest.fixtures[0],
							fixtureId: "TCC-A1-RUNNER-002",
							rawInputSha256: "b".repeat(64),
						},
					],
				},
				{
					evaluate: (input) => {
						calls.push(input);
						return acceptedOutcome;
					},
				},
				matchingHashPort,
			),
		).resolves.toEqual({
			kind: "invalid-corpus",
			violations: ["FIXTURE_SHA256_MISMATCH:TCC-A1-RUNNER-002"],
		});
		expect(calls).toEqual([]);
	});

	it("reports an unavailable hash operation before invoking the executor", async () => {
		const calls: unknown[] = [];

		await expect(
			runTccA1Corpus(
				manifest,
				{
					evaluate: (input) => {
						calls.push(input);
						return acceptedOutcome;
					},
				},
				{
					sha256: async () =>
						Promise.reject(new Error("hash hardware unavailable")),
				},
			),
		).resolves.toEqual({
			kind: "invalid-corpus",
			violations: ["FIXTURE_SHA256_UNAVAILABLE:TCC-A1-RUNNER-001"],
		});
		expect(calls).toEqual([]);
	});

	it("gives the executor a fresh fixture snapshot without the expected outcome and compares all accepted evidence", async () => {
		const received: unknown[] = [];

		await expect(
			runTccA1Corpus(
				manifest,
				{
					evaluate: (input) => {
						received.push(input);
						return matchingExecutor.evaluate(input);
					},
				},
				matchingHashPort,
			),
		).resolves.toEqual({
			kind: "passed",
			records: [{ kind: "matched", fixtureId: "TCC-A1-RUNNER-001" }],
		});
		expect(received).toEqual([
			{
				baseStateDigest: "plan:empty",
				fixtureId: "TCC-A1-RUNNER-001",
				intent: manifest.fixtures[0].intent,
				rawInputBytes: fixtureBytes,
			},
		]);
		expect(received[0]).not.toHaveProperty("expected");

		const changedCandidate = received[0] as {
			intent: {
				labels: string[];
				raw: { end: { xMm: string } };
			};
			rawInputBytes: number[];
		};
		expect(() => changedCandidate.rawInputBytes.push(0)).toThrow();
		expect(() => changedCandidate.intent.labels.push("mutated")).toThrow();
		expect(() => {
			changedCandidate.intent.raw.end.xMm = "1.5";
		}).toThrow();
		expect(Object.isFrozen(changedCandidate.intent)).toBe(true);
		expect(Object.isFrozen(changedCandidate.intent.labels)).toBe(true);
		expect(
			Object.getOwnPropertyDescriptor(changedCandidate.intent, "raw"),
		).toMatchObject({
			configurable: false,
			enumerable: true,
			writable: false,
		});
		expect(manifest.fixtures[0].rawInputBytes).toEqual([0x7b, 0x7d]);
		expect(manifest.fixtures[0].intent).toEqual({
			kind: "fixture-wall",
			labels: ["initial"],
			raw: {
				end: { xMm: "1000", zMm: "1000" },
				start: { xMm: "0", zMm: "0" },
			},
		});
	});

	it("freezes one manifest snapshot before awaiting the hash adapter, so an owner cannot race expected or intent data", async () => {
		let releaseHash: ((value: string) => void) | undefined;
		let markHashStarted: (() => void) | undefined;
		const hashStarted = new Promise<void>((resolve) => {
			markHashStarted = resolve;
		});
		const hashGate = new Promise<string>((resolve) => {
			releaseHash = resolve;
		});
		const mutableFixture = {
			...manifest.fixtures[0],
			expected: { ...acceptedOutcome },
			intent: {
				kind: "fixture-wall" as const,
				labels: ["initial"],
				raw: {
					end: { xMm: "1000", zMm: "1000" },
					start: { xMm: "0", zMm: "0" },
				},
			},
		};
		const raceManifest: TccA1CorpusManifest<FixtureIntent> = {
			...manifest,
			fixtures: [mutableFixture],
		};
		const received: unknown[] = [];
		const run = runTccA1Corpus(
			raceManifest,
			{
				evaluate: (input) => {
					received.push(input);
					return acceptedOutcome;
				},
			},
			{
				sha256: async () => {
					markHashStarted?.();
					return hashGate;
				},
			},
		);

		await hashStarted;
		(mutableFixture.expected as { postStateDigest: string }).postStateDigest =
			"plan:mutated-after-hash-start";
		mutableFixture.intent.raw.end.xMm = "1.5";
		mutableFixture.intent.labels.push("mutated-after-hash-start");
		releaseHash?.(expectedFixtureHash);

		await expect(run).resolves.toEqual({
			kind: "passed",
			records: [{ fixtureId: "TCC-A1-RUNNER-001", kind: "matched" }],
		});
		expect(received).toEqual([
			{
				baseStateDigest: "plan:empty",
				fixtureId: "TCC-A1-RUNNER-001",
				intent: manifest.fixtures[0].intent,
				rawInputBytes: fixtureBytes,
			},
		]);
	});

	it.each([
		[
			{ ...acceptedOutcome, kind: "rejected" } as unknown as TccA1Outcome,
			"OUTCOME_KIND_MISMATCH",
		],
		[
			{ ...acceptedOutcome, postStateDigest: "plan:wrong" },
			"POST_STATE_MISMATCH",
		],
		[
			{
				...acceptedOutcome,
				allocationIntent: ["vertex:start", "wall:initial"],
			},
			"ALLOCATION_INTENT_MISMATCH",
		],
		[
			{
				...acceptedOutcome,
				allocationIntent: ["wrong", "vertex:end", "wall:initial"],
			},
			"ALLOCATION_INTENT_MISMATCH",
		],
		[
			{ ...acceptedOutcome, opaqueCandidateRefs: ["candidate:wrong"] },
			"OPAQUE_CANDIDATE_REFS_MISMATCH",
		],
		[
			{
				...acceptedOutcome,
				opaqueCandidateRefs: [
					"wrong",
					"candidate:vertex:end",
					"candidate:wall:initial",
				],
			},
			"OPAQUE_CANDIDATE_REFS_MISMATCH",
		],
		[
			{ ...acceptedOutcome, inverseStateDigest: "plan:wrong" },
			"INVERSE_STATE_MISMATCH",
		],
	] as const)(
		"fails a completed accepted execution with %s",
		async (observed, reasonCode) => {
			await expect(
				runTccA1Corpus(
					manifest,
					{ evaluate: () => observed },
					matchingHashPort,
				),
			).resolves.toEqual({
				kind: "failed",
				records: [
					{ fixtureId: "TCC-A1-RUNNER-001", kind: "mismatched", reasonCode },
				],
			});
		},
	);

	it("does not mistake a partial match across two hash-valid fixtures for a passing corpus", async () => {
		const secondFixture = {
			...manifest.fixtures[0],
			fixtureId: "TCC-A1-RUNNER-002",
		};
		const twoFixtureManifest: TccA1CorpusManifest<FixtureIntent> = {
			...manifest,
			fixtures: [manifest.fixtures[0], secondFixture],
		};

		await expect(
			runTccA1Corpus(
				twoFixtureManifest,
				{
					evaluate: ({ fixtureId }) =>
						fixtureId === "TCC-A1-RUNNER-001"
							? acceptedOutcome
							: { ...acceptedOutcome, inverseStateDigest: "plan:wrong" },
				},
				matchingHashPort,
			),
		).resolves.toEqual({
			kind: "failed",
			records: [
				{ fixtureId: "TCC-A1-RUNNER-001", kind: "matched" },
				{
					fixtureId: "TCC-A1-RUNNER-002",
					kind: "mismatched",
					reasonCode: "INVERSE_STATE_MISMATCH",
				},
			],
		});
	});

	it.each([
		"PROJECT_BOUNDS_EXCEEDED",
		"UNSUPPORTED_DIRECTION",
		"ZERO_LENGTH",
	] as const)(
		"accepts the declared source-owned %s rejection reason",
		(reasonCode) => {
			expect(
				inspectTccA1CorpusManifest({
					...manifest,
					fixtures: [
						{
							...manifest.fixtures[0],
							expected: {
								allocationIntent: [],
								kind: "rejected",
								postStateDigest: "plan:empty",
								reasonCode,
							},
						},
					],
				}),
			).toEqual([]);
		},
	);

	it.each([
		[
			{ ...acceptedOutcome, kind: "accepted" } as TccA1Outcome,
			"OUTCOME_KIND_MISMATCH",
		],
		[
			{
				allocationIntent: [],
				kind: "rejected",
				postStateDigest: "plan:wrong",
				reasonCode: "INVALID_DIMENSION",
			} as TccA1Outcome,
			"REJECTED_STATE_CHANGED",
		],
		[
			{
				allocationIntent: ["forbidden"],
				kind: "rejected",
				postStateDigest: "plan:empty",
				reasonCode: "INVALID_DIMENSION",
			} as unknown as TccA1Outcome,
			"REJECTED_ALLOCATION_INTENT",
		],
		[
			{
				allocationIntent: [],
				kind: "rejected",
				postStateDigest: "plan:empty",
				reasonCode: "ZERO_LENGTH",
			} as TccA1Outcome,
			"REASON_CODE_MISMATCH",
		],
	] as const)(
		"fails a completed stable rejection with %s",
		async (observed, reasonCode) => {
			const rejectedManifest: TccA1CorpusManifest<FixtureIntent> = {
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: {
							allocationIntent: [],
							kind: "rejected",
							postStateDigest: "plan:empty",
							reasonCode: "INVALID_DIMENSION",
						},
					},
				],
			};

			await expect(
				runTccA1Corpus(
					rejectedManifest,
					{ evaluate: () => observed },
					matchingHashPort,
				),
			).resolves.toEqual({
				kind: "failed",
				records: [
					{ fixtureId: "TCC-A1-RUNNER-001", kind: "mismatched", reasonCode },
				],
			});
		},
	);

	it("records a throwing executor as a failed corpus fixture instead of leaking an unclassified exception", async () => {
		await expect(
			runTccA1Corpus(
				manifest,
				{
					evaluate: () => {
						throw new Error("kernel unavailable");
					},
				},
				matchingHashPort,
			),
		).resolves.toEqual({
			kind: "failed",
			records: [
				{
					fixtureId: "TCC-A1-RUNNER-001",
					kind: "mismatched",
					reasonCode: "EXECUTOR_UNAVAILABLE",
				},
			],
		});
	});

	it("records an asynchronous cancelled materialization as a no-allocation transient fixture", async () => {
		const cancelledManifest: TccA1CorpusManifest<FixtureIntent> = {
			...manifest,
			fixtures: [
				{
					...manifest.fixtures[0],
					expected: {
						allocationIntent: [] as const,
						kind: "transient",
						postStateDigest: "plan:empty",
						transientKind: "cancelled",
					},
				},
			],
		};
		const callOrder: string[] = [];

		await expect(
			runTccA1Corpus(
				cancelledManifest,
				{
					evaluate: async () => {
						callOrder.push("evaluate");
						return {
							allocationIntent: [] as const,
							kind: "transient",
							postStateDigest: "plan:empty",
							transientKind: "cancelled",
						};
					},
				},
				{
					sha256: async () => {
						callOrder.push("hash");
						return expectedFixtureHash;
					},
				},
			),
		).resolves.toEqual({
			kind: "passed",
			records: [{ fixtureId: "TCC-A1-RUNNER-001", kind: "matched" }],
		});
		expect(callOrder).toEqual(["hash", "evaluate"]);
	});

	it.each([
		[
			"changes the base state",
			{
				allocationIntent: [] as const,
				kind: "transient" as const,
				postStateDigest: "plan:changed",
				transientKind: "cancelled" as const,
			},
			"TRANSIENT_STATE_CHANGED",
		],
		[
			"exposes an allocation",
			{
				allocationIntent: ["leaked-slot"],
				kind: "transient" as const,
				postStateDigest: "plan:empty",
				transientKind: "cancelled" as const,
			},
			"TRANSIENT_ALLOCATION_INTENT",
		],
		[
			"changes the declared transient kind",
			{
				allocationIntent: [] as const,
				kind: "transient" as const,
				postStateDigest: "plan:empty",
				transientKind: "lost-fence" as const,
			},
			"TRANSIENT_KIND_MISMATCH",
		],
	] as const)(
		"fails a transient fixture that %s",
		async (_caseName, observed, reasonCode) => {
			const cancelledManifest: TccA1CorpusManifest<FixtureIntent> = {
				...manifest,
				fixtures: [
					{
						...manifest.fixtures[0],
						expected: {
							allocationIntent: [] as const,
							kind: "transient",
							postStateDigest: "plan:empty",
							transientKind: "cancelled",
						},
					},
				],
			};

			await expect(
				runTccA1Corpus(
					cancelledManifest,
					{
						evaluate: async () => observed as unknown as TccA1Outcome,
					},
					matchingHashPort,
				),
			).resolves.toEqual({
				kind: "failed",
				records: [
					{ fixtureId: "TCC-A1-RUNNER-001", kind: "mismatched", reasonCode },
				],
			});
		},
	);

	it("runs the first detached empty-plan wall command through a real-SHA-256-bound TCC-A1 seed corpus", async () => {
		await expect(
			runTccA1Corpus(
				initialEmptyPlanGraphWallTccA1Corpus,
				emptyPlanGraphWallCorpusExecutor,
				webCryptoHashPort,
			),
		).resolves.toEqual({
			kind: "passed",
			records: [
				{ fixtureId: "TCC-A1-EMPTY-WALL-001", kind: "matched" },
				{ fixtureId: "TCC-A1-EMPTY-WALL-002", kind: "matched" },
			],
		});
	});

	it("rejects a one-byte seed fixture mutation with the real SHA-256 adapter before calling the kernel", async () => {
		const mutatedCorpus: TccA1CorpusManifest<FixtureIntent> = {
			...initialEmptyPlanGraphWallTccA1Corpus,
			fixtures: initialEmptyPlanGraphWallTccA1Corpus.fixtures.map(
				(fixture, index) =>
					index === 0
						? {
								...fixture,
								rawInputBytes: [
									fixture.rawInputBytes[0] ^ 0x01,
									...fixture.rawInputBytes.slice(1),
								],
							}
						: fixture,
			),
		} as unknown as TccA1CorpusManifest<FixtureIntent>;
		const calls: unknown[] = [];

		await expect(
			runTccA1Corpus(
				mutatedCorpus,
				{
					evaluate: (input) => {
						calls.push(input);
						return acceptedOutcome;
					},
				},
				webCryptoHashPort,
			),
		).resolves.toEqual({
			kind: "invalid-corpus",
			violations: ["FIXTURE_SHA256_MISMATCH:TCC-A1-EMPTY-WALL-001"],
		});
		expect(calls).toEqual([]);
	});

	it("keeps each seed fixture raw bytes, semantic intent and expected outcome in the same declared order", () => {
		expect(initialEmptyPlanGraphWallTccA1Corpus.fixtures).toMatchObject([
			{
				expected: acceptedOutcomeForSeed(),
				fixtureId: "TCC-A1-EMPTY-WALL-001",
				intent: {
					kind: "empty-plan-graph-wall",
					limits: { maxAbsoluteCoordinateMm: 100_000 },
					rawWallGeometry: {
						end: { xMm: "1000", zMm: "1000" },
						kind: "endpoints",
						start: { xMm: "0", zMm: "0" },
					},
				},
				rawInputSha256:
					"409db14815c4568339bdf096ffdaf621da88a0631756bdadf18a2a04fc9c89b3",
			},
			{
				expected: {
					allocationIntent: [],
					kind: "rejected",
					postStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
					reasonCode: "INVALID_DIMENSION",
				},
				fixtureId: "TCC-A1-EMPTY-WALL-002",
				intent: {
					kind: "empty-plan-graph-wall",
					limits: { maxAbsoluteCoordinateMm: 100_000 },
					rawWallGeometry: {
						end: { xMm: "1.5", zMm: "0" },
						kind: "endpoints",
						start: { xMm: "0", zMm: "0" },
					},
				},
				rawInputSha256:
					"ddd9c4f696740a6551d0d5396f9741b98183ea8799258d8fb394f8acb114dd0c",
			},
		]);
		expect(
			initialEmptyPlanGraphWallTccA1Corpus.fixtures.map((fixture) =>
				String.fromCharCode(...fixture.rawInputBytes),
			),
		).toEqual([
			'{"kind":"endpoints","start":{"xMm":"0","zMm":"0"},"end":{"xMm":"1000","zMm":"1000"}}',
			'{"kind":"endpoints","start":{"xMm":"0","zMm":"0"},"end":{"xMm":"1.5","zMm":"0"}}',
		]);
	});

	it("runs the real initial-wall materializer through cardinal, four diagonal and lifecycle TCC-A1 fixtures", async () => {
		const hashPort = webCryptoContentHashPort();

		await expect(
			runTccA1Corpus(
				initialWallMaterializationTccA1Corpus,
				createInitialWallMaterializationTccA1Executor(hashPort),
				hashPort,
			),
		).resolves.toEqual({
			kind: "passed",
			records: [
				{ fixtureId: "TCC-A1-INITIAL-WALL-001", kind: "matched" },
				{ fixtureId: "TCC-A1-INITIAL-WALL-002", kind: "matched" },
				{ fixtureId: "TCC-A1-INITIAL-WALL-003", kind: "matched" },
				{ fixtureId: "TCC-A1-INITIAL-WALL-004", kind: "matched" },
				{ fixtureId: "TCC-A1-INITIAL-WALL-005", kind: "matched" },
				{ fixtureId: "TCC-A1-INITIAL-WALL-006", kind: "matched" },
				{ fixtureId: "TCC-A1-INITIAL-WALL-007", kind: "matched" },
				{ fixtureId: "TCC-A1-INITIAL-WALL-008", kind: "matched" },
			],
		});
	});

	it("declares lifecycle expectations independently for cancellation, stale base and lost fence", () => {
		expect(
			initialWallMaterializationTccA1Corpus.fixtures
				.slice(5)
				.map((fixture) => ({
					fixtureId: fixture.fixtureId,
					expected: fixture.expected,
				})),
		).toEqual([
			{
				fixtureId: "TCC-A1-INITIAL-WALL-006",
				expected: {
					allocationIntent: [],
					kind: "transient",
					postStateDigest:
						"26674bcb07ee4e553621347ee3bcdd03c70088ddb02c35a54149ed272c885bcb",
					transientKind: "cancelled",
				},
			},
			{
				fixtureId: "TCC-A1-INITIAL-WALL-007",
				expected: {
					allocationIntent: [],
					kind: "transient",
					postStateDigest:
						"26674bcb07ee4e553621347ee3bcdd03c70088ddb02c35a54149ed272c885bcb",
					transientKind: "stale-base",
				},
			},
			{
				fixtureId: "TCC-A1-INITIAL-WALL-008",
				expected: {
					allocationIntent: [],
					kind: "transient",
					postStateDigest:
						"26674bcb07ee4e553621347ee3bcdd03c70088ddb02c35a54149ed272c885bcb",
					transientKind: "lost-fence",
				},
			},
		]);
	});

	it("refuses an executor input whose semantic command or base digest does not bind the materializer request", async () => {
		const hashPort = webCryptoContentHashPort();
		const fixture = initialWallMaterializationTccA1Corpus.fixtures[0];
		if (!fixture) {
			throw new Error("Expected the first initial-wall fixture");
		}
		const executor = createInitialWallMaterializationTccA1Executor(hashPort);

		await expect(
			executor.evaluate({
				baseStateDigest: "wrong-base-digest",
				fixtureId: fixture.fixtureId,
				intent: fixture.intent,
				rawInputBytes: fixture.rawInputBytes,
			}),
		).rejects.toThrow("not bound to its base graph");
		await expect(
			executor.evaluate({
				baseStateDigest: fixture.baseStateDigest,
				fixtureId: fixture.fixtureId,
				intent: {
					...fixture.intent,
					kind: "different-command",
				} as unknown as typeof fixture.intent,
				rawInputBytes: fixture.rawInputBytes,
			}),
		).rejects.toThrow("not bound to its base graph");
		await expect(
			executor.evaluate({
				baseStateDigest: fixture.baseStateDigest,
				fixtureId: fixture.fixtureId,
				intent: {
					...fixture.intent,
					materializationInput: {
						...fixture.intent.materializationInput,
						intent: {
							...fixture.intent.materializationInput.intent,
							projectLimitsPolicyHash: "f".repeat(64),
						},
					},
				},
				rawInputBytes: fixture.rawInputBytes,
			}),
		).rejects.toThrow("does not declare private route-unavailable outcomes");
	});

	it.each([
		[
			"leaked allocation slots",
			{
				allocationIntent: {
					slots: [{ label: "wall", wallSegmentId: "wrong-wall" }],
				},
				baseGraph: {
					levelId: "level-1",
					projectLimitsPolicyHash:
						"a86d7d9ca1262f932355f1d8a6031b641f28b2446c9d4c455cc5f03d5d183369",
					verticesById: {},
					wallSegmentsById: {},
				},
				kind: "not-materialized",
				status: "Cancelled",
			},
			"TRANSIENT_ALLOCATION_INTENT",
		],
		[
			"a changed returned base graph",
			{
				allocationIntent: { slots: [] },
				baseGraph: {
					levelId: "level-2",
					projectLimitsPolicyHash:
						"a86d7d9ca1262f932355f1d8a6031b641f28b2446c9d4c455cc5f03d5d183369",
					verticesById: {},
					wallSegmentsById: {},
				},
				kind: "not-materialized",
				status: "Cancelled",
			},
			"TRANSIENT_STATE_CHANGED",
		],
	] as const)(
		"surfaces %s from a materializer transient to the corpus runner",
		async (_caseName, result, reasonCode) => {
			const hashPort = webCryptoContentHashPort();
			const fixture = initialWallMaterializationTccA1Corpus.fixtures[5];
			if (!fixture) {
				throw new Error("Expected the cancelled initial-wall fixture");
			}
			const observed = await Reflect.apply(
				adaptInitialWallMaterializationResultToTccA1Outcome,
				undefined,
				[result, hashPort],
			);
			const manifest: TccA1CorpusManifest<typeof fixture.intent> = {
				...initialWallMaterializationTccA1Corpus,
				fixtures: [fixture],
			};

			await expect(
				runTccA1Corpus(manifest, { evaluate: async () => observed }, hashPort),
			).resolves.toEqual({
				kind: "failed",
				records: [
					{ fixtureId: fixture.fixtureId, kind: "mismatched", reasonCode },
				],
			});
		},
	);

	it.each([
		["a leaked vertex", { "leaked-vertex": { xMm: 100, zMm: 200 } }, {}],
		[
			"a leaked wall",
			{},
			{
				"leaked-wall": {
					endVertexId: "end",
					startVertexId: "start",
					thicknessMm: 120,
				},
			},
		],
	] as const)(
		"does not turn %s in a materializer transient into corpus success",
		async (_caseName, verticesById, wallSegmentsById) => {
			const hashPort = webCryptoContentHashPort();
			const fixture = initialWallMaterializationTccA1Corpus.fixtures[5];
			if (!fixture) {
				throw new Error("Expected the cancelled initial-wall fixture");
			}
			const corruptResult = {
				allocationIntent: { slots: [] },
				baseGraph: {
					levelId: "level-1",
					projectLimitsPolicyHash:
						"a86d7d9ca1262f932355f1d8a6031b641f28b2446c9d4c455cc5f03d5d183369",
					verticesById,
					wallSegmentsById,
				},
				kind: "not-materialized",
				status: "Cancelled",
			};
			const manifest: TccA1CorpusManifest<typeof fixture.intent> = {
				...initialWallMaterializationTccA1Corpus,
				fixtures: [fixture],
			};

			await expect(
				runTccA1Corpus(
					manifest,
					{
						evaluate: () =>
							Reflect.apply(
								adaptInitialWallMaterializationResultToTccA1Outcome,
								undefined,
								[corruptResult, hashPort],
							),
					},
					hashPort,
				),
			).resolves.toEqual({
				kind: "failed",
				records: [
					{
						fixtureId: fixture.fixtureId,
						kind: "mismatched",
						reasonCode: "EXECUTOR_UNAVAILABLE",
					},
				],
			});
		},
	);
});

function acceptedOutcomeForSeed(): TccA1Outcome {
	return {
		allocationIntent: ["vertex:start", "vertex:end", "wall:initial"],
		inverseStateDigest: EMPTY_DETACHED_PLAN_GRAPH_STATE_DIGEST,
		kind: "accepted",
		opaqueCandidateRefs: [
			"candidate:vertex:start",
			"candidate:vertex:end",
			"candidate:wall:initial",
		],
		postStateDigest: "tcc-a1:detached-plan-graph:wall:0,0:1000,1000",
	};
}

function webCryptoContentHashPort(): ContentHashPort & TccA1FixtureHashPort {
	const sha256 = async (bytes: Uint8Array): Promise<string> => {
		const digest = await (
			globalThis as unknown as {
				crypto: {
					subtle: {
						digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
					};
				};
			}
		).crypto.subtle.digest("SHA-256", bytes);
		return [...new Uint8Array(digest)]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
	};
	return {
		sha256,
		sha256Utf8Ascii: async (preimage) =>
			sha256(
				Uint8Array.from(
					[...preimage].map((character) => character.charCodeAt(0)),
				),
			),
	};
}

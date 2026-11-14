import test from "node:test";
import assert from "node:assert/strict";
import {
	groupPlan,
	requireInvocation,
	baselineEnvironment,
	bytesManifest,
	requireSameManifest,
	qualifyBaseline,
	requireBuildOutput,
	requireRuntimePins,
} from "./additive-public-contract.mjs";
const spec = (id = "one") => ({
	id,
	file: "case.check.ts",
	title: "public case " + id,
	line: 2,
	column: 1,
});
const fixture = () => {
	const plan = [spec("one"), spec("two")],
		sources = { "source.ts": "1".repeat(64) },
		rows = plan.map((s) => ({
			testId: s.id,
			file: "/owned/case.check.ts",
			title: s.title,
			pid: 12,
			id: null,
			selected: [],
			expectedSources: sources,
			valid: true,
			actual: {
				html: null,
				modules: {
					"source.ts": {
						sha: sources["source.ts"],
						instrumented: false,
						active: null,
						hasActive: false,
						localIdCount: 0,
					},
				},
			},
		}));
	const report = {
		config: { rootDir: "/owned" },
		suites: [
			{
				specs: plan.map((s) => ({
					...s,
					tests: [
						{
							expectedStatus: "passed",
							results: [
								{
									status: "passed",
									retry: 0,
									workerIndex: 0,
									parallelIndex: 0,
									errors: [],
									attachments: [
										{
											name: "actual-factory-native-body",
											contentType: "application/json",
											body: Buffer.from(
												JSON.stringify({
													testId: s.id,
													file: "/owned/case.check.ts",
													title: s.title,
													pid: 12,
													phase: "entered",
												}),
											).toString("base64"),
										},
										{
											name: "actual-factory-native-body",
											contentType: "application/json",
											body: Buffer.from(
												JSON.stringify({
													testId: s.id,
													file: "/owned/case.check.ts",
													title: s.title,
													pid: 12,
													phase: "settled",
													outcome: "fulfilled",
												}),
											).toString("base64"),
										},
									],
								},
							],
						},
					],
				})),
			},
		],
		errors: [],
		stats: { expected: 2, unexpected: 0, skipped: 0, flaky: 0 },
	};
	return {
		report,
		rows,
		plan,
		sources,
		rawBinding: { valid: true, records: 2 },
		native: {
			pid: 10,
			code: 0,
			signal: null,
			closed: true,
			timedOut: false,
			pipeAbandonment: false,
			ownership: { issues: [], remaining: [] },
		},
	};
};
test("dedicated group plans keep exactly2 cancellation or6 key cases", () => {
	assert.equal(groupPlan("cancellation").count, 2);
	assert.equal(groupPlan("key").count, 6);
	assert.throws(() => groupPlan("old15"));
});
test("Native route refuses before invoking any supplied work without explicit lease", () => {
	assert.throws(
		() =>
			requireInvocation({
				group: "key",
				native: true,
				lease: undefined,
				env: {},
			}),
		/lease/,
	);
	assert.doesNotThrow(() =>
		requireInvocation({ group: "key", native: false, env: {} }),
	);
	assert.doesNotThrow(() =>
		requireInvocation({
			group: "key",
			native: true,
			lease: "Root-bounded-key6",
			env: { ADDITIVE_PUBLIC_NATIVE_SLOT: "reserved" },
		}),
	);
});
test("baseline env removes inherited selectors, proof poisons and context reuse", () => {
	const out = baselineEnvironment(
		{
			PATH: "/bin",
			__STRYKER_ACTIVE_MUTANT__: "70",
			SCOPED_POISON_ACTIVE: "1",
			COMMON205_MISSING_SELECTOR: "1",
			PW_TEST_REUSE_CONTEXT: "1",
			FACTORY_NATIVE_PHASE: "bad",
		},
		"/owned",
	);
	assert.equal(out.PATH, "/bin");
	for (const key of [
		"__STRYKER_ACTIVE_MUTANT__",
		"SCOPED_POISON_ACTIVE",
		"COMMON205_MISSING_SELECTOR",
		"PW_TEST_REUSE_CONTEXT",
		"FACTORY_NATIVE_PHASE",
	])
		assert.equal(out[key], undefined);
	assert.equal(out.TMPDIR, "/owned");
});
test("emitted byte inventory refuses missing, unknown and changed members", () => {
	const a = bytesManifest({ "x.js": Buffer.from("exact") });
	assert.doesNotThrow(() => requireSameManifest(a, a));
	for (const b of [
		bytesManifest({ "x.js": Buffer.from("other") }),
		{},
		{ ...a, "foreign.js": a["x.js"] },
	])
		assert.throws(() => requireSameManifest(a, b));
});
test("complete owning plain-source baseline accepts only exact2 BODY pairs", () => {
	const x = qualifyBaseline(fixture());
	assert.equal(x.valid, true, x.issues.join(","));
	assert.equal(x.executed, 2);
});
for (const [name, change] of [
	["missing result", (x) => x.report.suites[0].specs.pop()],
	["duplicate ID", (x) => (x.report.suites[0].specs[1].id = "one")],
	["moved coordinate", (x) => x.report.suites[0].specs[0].line++],
	[
		"skip",
		(x) => (x.report.suites[0].specs[0].tests[0].results[0].status = "skipped"),
	],
	["global", (x) => x.report.errors.push({ message: "foreign" })],
	[
		"body timeout",
		(x) =>
			(x.report.suites[0].specs[0].tests[0].results[0].errors = [
				{ message: "Test timeout of 10000ms exceeded" },
			]),
	],
	[
		"cleanup cause",
		(x) =>
			(x.report.suites[0].specs[0].tests[0].results[0].error = {
				message: "body",
				cause: { message: "SCOPED_PROOF_INVALID cleanup" },
			}),
	],
	[
		"empty error",
		(x) => (x.report.suites[0].specs[0].tests[0].results[0].errors = [{}]),
	],
	[
		"wrong source",
		(x) => (x.rows[0].actual.modules["source.ts"].sha = "f".repeat(64)),
	],
	["foreign selected", (x) => (x.rows[0].selected = ["source.ts"])],
	[
		"instrumented",
		(x) => (x.rows[0].actual.modules["source.ts"].instrumented = true),
	],
	[
		"foreign BODY PID",
		(x) => {
			const a = x.report.suites[0].specs[0].tests[0].results[0].attachments[0];
			const v = JSON.parse(Buffer.from(a.body, "base64"));
			v.pid = 13;
			a.body = Buffer.from(JSON.stringify(v)).toString("base64");
		},
	],
	[
		"missing BODY",
		(x) => x.report.suites[0].specs[0].tests[0].results[0].attachments.pop(),
	],
	["raw formatter invalid", (x) => (x.rawBinding.valid = false)],
	["no actual CLOSE", (x) => (x.native.closed = false)],
	["pipe abandonment", (x) => (x.native.pipeAbandonment = true)],
	[
		"unknown physical holder",
		(x) => (x.native.ownership.remaining = [{ pid: 99 }]),
	],
	["wrong CLI exit", (x) => (x.native.code = 2)],
])
	test("baseline refuses " + name, () => {
		const x = fixture();
		change(x);
		assert.equal(qualifyBaseline(x).valid, false);
	});

test("successful build CLI cannot hide compiler/copy errors in its output", () => {
	assert.doesNotThrow(() =>
		requireBuildOutput({ code: 0, text: "Rspack compiled successfully" }),
	);
	for (const text of [
		"Build errors: unable to locate sibling.glb",
		"ERROR in ./missing-entry.ts",
		"Module not found: unresolved",
		"Rspack compiled with 2 errors",
	])
		assert.throws(() => requireBuildOutput({ code: 0, text }));
	assert.throws(() => requireBuildOutput({ code: 1, text: "failed" }));
});

test("runtime dependency pins reject changed formatter bytes or incomplete closures", () => {
	const a = { "/actual/formatter.js": "1".repeat(64) };
	assert.doesNotThrow(() => requireRuntimePins(a, a));
	for (const b of [
		{},
		{ "/actual/formatter.js": "2".repeat(64) },
		{ ...a, foreign: "3".repeat(64) },
	])
		assert.throws(() => requireRuntimePins(a, b));
	assert.throws(() => requireRuntimePins({}, {}));
});

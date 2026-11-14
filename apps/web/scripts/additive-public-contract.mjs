import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual as same } from "node:util";
const groups = {
	cancellation: {
		count: 2,
		testMatch: "browser-registered-cancellation-e2e.check.ts",
		entry: "tests/verification/browser-registered-cancellation-entry.ts",
		config: "playwright.browser-registered-cancellation.config.mjs",
	},
	key: {
		count: 6,
		testMatch: "browser-key-public-boundaries-e2e.check.ts",
		entry: "tests/verification/browser-key-public-boundaries-entry.ts",
		config: "playwright.browser-key-public-boundaries.config.mjs",
	},
};
export function groupPlan(group) {
	if (!Object.hasOwn(groups, group))
		throw Error(
			"ADDITIVE_PUBLIC_PROOF_INVALID: exact cancellation/key group required",
		);
	return { ...groups[group] };
}
export function requireInvocation({ group, native, lease, env = process.env }) {
	groupPlan(group);
	if (native && (!lease || env.ADDITIVE_PUBLIC_NATIVE_SLOT !== "reserved"))
		throw Error(
			"ADDITIVE_PUBLIC_PROOF_INVALID: explicit Root Native lease required before work",
		);
}
export function baselineEnvironment(base, root) {
	const out = { ...base };
	for (const key of Object.keys(out))
		if (
			/^(?:SCOPED_|COMMON205_|FACTORY_NATIVE_|BR_|ADDITIVE_PUBLIC_|PLAYWRIGHT_TMA_STORAGE_|PW_TEST_(?:REUSE_CONTEXT|CONNECT_WS_ENDPOINT|CONNECT_HEADERS)|__STRYKER_ACTIVE_MUTANT__$)/.test(
				key,
			)
		)
			delete out[key];
	return { ...out, TMPDIR: root, TMP: root, TEMP: root };
}
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function bytesManifest(files) {
	return Object.fromEntries(
		Object.entries(files).map(([name, bytes]) => [
			name,
			{ bytes: bytes.length, sha256: sha(bytes) },
		]),
	);
}
export function requireSameManifest(expected, actual) {
	if (!same(expected, actual))
		throw Error(
			"ADDITIVE_PUBLIC_PROOF_INVALID: emitted byte inventory changed",
		);
}
const canonical = (p) =>
	resolve(p)
		.replace(/^\/private\/var\//, "/var/")
		.replace(/^\/private\/tmp\//, "/tmp/");
const specs = (s) => [...(s.specs ?? []), ...(s.suites ?? []).flatMap(specs)];
const positive = (n) => Number.isSafeInteger(n) && n > 0;
export function qualifyBaseline({
	report,
	rows,
	plan,
	sources,
	rawBinding,
	native,
}) {
	const issues = [],
		need = (value, why) => {
			if (!value) issues.push(why);
		};
	let executed = 0;
	try {
		need(
			native?.code === 0 &&
				native.signal === null &&
				native.closed === true &&
				native.timedOut === false &&
				!native.pipeAbandonment &&
				positive(native.pid) &&
				Array.isArray(native.ownership?.issues) &&
				native.ownership.issues.length === 0 &&
				Array.isArray(native.ownership?.remaining) &&
				native.ownership.remaining.length === 0,
			"supported actual CLI/CLOSE/physical0",
		);
		need(
			rawBinding?.valid === true && rawBinding.records === plan.length,
			"exact pinned raw/formatter bijection",
		);
		const found = specs(report),
			keys = (s) => [s.id, s.file, s.title, s.line, s.column];
		need(
			found.length === plan.length &&
				new Set(found.map((s) => s.id)).size === plan.length &&
				same(found.map(keys), plan.map(keys)),
			"exact dedicated discovered cohort",
		);
		need(
			Array.isArray(rows) &&
				rows.length === plan.length &&
				new Set(rows.map((r) => r.testId)).size === plan.length,
			"exact navigation records",
		);
		need(
			Array.isArray(report.errors) && report.errors.length === 0,
			"no global errors",
		);
		need(
			same(
				{
					expected: report.stats?.expected,
					unexpected: report.stats?.unexpected,
					skipped: report.stats?.skipped,
					flaky: report.stats?.flaky,
				},
				{ expected: plan.length, unexpected: 0, skipped: 0, flaky: 0 },
			),
			"full clean statistics",
		);
		const pids = new Set();
		for (const spec of found) {
			need(
				spec.tests?.length === 1 &&
					spec.tests[0].expectedStatus === "passed" &&
					spec.tests[0].results?.length === 1,
				"single actual result",
			);
			const result = spec.tests?.[0]?.results?.[0];
			if (!result) continue;
			need(
				result.status === "passed" &&
					result.retry === 0 &&
					result.workerIndex === 0 &&
					result.parallelIndex === 0 &&
					Array.isArray(result.errors) &&
					result.errors.length === 0 &&
					!Object.hasOwn(result, "error"),
				"passed result cannot hide body/cleanup/cause/timeout payload",
			);
			const marker = rows.find((r) => r.testId === spec.id),
				file = canonical(resolve(report.config.rootDir, spec.file));
			need(
				marker?.valid === true &&
					canonical(marker.file) === file &&
					marker.title === spec.title &&
					marker.id === null &&
					same(marker.selected, []) &&
					same(marker.expectedSources, sources) &&
					marker.actual?.html === null &&
					positive(marker.pid) &&
					marker.pid !== native.pid,
				"owning baseline navigation/worker",
			);
			if (marker) pids.add(marker.pid);
			const modules = marker?.actual?.modules;
			need(
				modules &&
					same(Object.keys(modules).sort(), Object.keys(sources).sort()) &&
					Object.entries(sources).every(
						([path, hash]) =>
							modules[path]?.sha === hash &&
							modules[path].instrumented === false &&
							modules[path].active === null &&
							modules[path].hasActive === false &&
							modules[path].localIdCount === 0,
					),
				"exact actual plain source/namespace inventory",
			);
			const probes = (result.attachments ?? [])
				.filter((a) => a.name === "actual-factory-native-body")
				.map((a) => {
					if (
						a.contentType !== "application/json" ||
						typeof a.body !== "string"
					)
						throw Error("malformed owning BODY attachment");
					return JSON.parse(Buffer.from(a.body, "base64").toString());
				});
			need(
				probes.length === 2 &&
					probes[0].phase === "entered" &&
					probes[1].phase === "settled" &&
					probes[1].outcome === "fulfilled" &&
					probes.every(
						(p) =>
							p.testId === spec.id &&
							canonical(p.file) === file &&
							p.title === spec.title &&
							p.pid === marker?.pid,
					),
				"exact owning fulfilled BODY pair",
			);
			executed++;
		}
		need(pids.size === 1, "exact one observed worker");
	} catch (error) {
		issues.push("malformed baseline evidence: " + String(error));
	}
	return {
		valid: issues.length === 0,
		issues: [...new Set(issues)],
		executed,
		NativeExecuted: true,
		behaviorDetection: false,
		score: null,
	};
}

export function requireBuildOutput({ code, text }) {
	if (
		code !== 0 ||
		typeof text !== "string" ||
		/Build errors?|unable to locate|Module not found|Module build failed|ERROR in |compiled with [1-9][0-9]* errors?/i.test(
			text,
		)
	)
		throw Error(
			"ADDITIVE_PUBLIC_PROOF_INVALID: compiler/copy failure cannot qualify",
		);
}

export function requireRuntimePins(expected, actual) {
	if (
		!expected ||
		!Object.keys(expected).length ||
		Object.values(expected).some(
			(value) => typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value),
		) ||
		!same(expected, actual)
	)
		throw Error(
			"ADDITIVE_PUBLIC_PROOF_INVALID: frozen runtime dependency closure drift",
		);
}

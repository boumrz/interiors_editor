// Focused mutation evidence for 45-degree construction snapping used to close
// the first exact triangular Room on a phone.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.config.mjs src/ui/wall-draft.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/triangular-room-mutation.json",
	},
	mutate: [
		// Four explicit branches select the diagonal closure route; each has a
		// distinct user-visible direction and is covered below.
		"src/ui/wall-draft.ts:249-254",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: {
		break: 80,
		high: 80,
		low: 70,
	},
};

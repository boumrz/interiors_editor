// Focused mutation evidence for mandatory ephemeral usable Room metrics.
// It runs in place; do not edit selected modules while this command is running.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/derived-orthogonal-plan-faces.test.ts src/domain/derived-project-v2-plan.test.ts src/ui/room-measurement.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/usable-room-metrics-mutation.json",
	},
	mutate: [
		"src/domain/derived-orthogonal-plan-faces.ts:383-384",
		"src/domain/derived-orthogonal-plan-faces.ts:821-824",
		"src/domain/derived-project-v2-plan.ts:118-119",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};

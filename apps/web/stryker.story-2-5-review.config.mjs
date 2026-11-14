// Focused mutation evidence for Story 2.5: hard thickness limits, exact
// polygon joins/hosts/measurements, stable publication and durable reload.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/general-wall-project.test.ts src/domain/derived-orthogonal-plan-faces.test.ts src/domain/parametric-item.test.ts src/domain/project-json-transfer.test.ts src/domain/measurement-format.test.ts src/application/general-wall-project-mutations.test.ts src/ui/room-measurement.test.tsx",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/story-2-5-review-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:742-817",
		"src/domain/general-wall-project.ts:2159-2172",
		"src/domain/general-wall-project.ts:2202-2255",
		"src/domain/general-wall-project.ts:2973-2989",
		"src/domain/general-wall-project.ts:3040-3063",
		"src/domain/general-wall-project.ts:3225-3230",
		"src/domain/general-wall-project.ts:3257-3284",
		"src/domain/derived-orthogonal-plan-faces.ts:839-840",
		"src/domain/derived-orthogonal-plan-faces.ts:866-886",
		"src/domain/derived-orthogonal-plan-faces.ts:918-922",
		"src/domain/parametric-item.ts:656-672",
		"src/domain/project-json-transfer.ts:296-296",
		"src/domain/measurement-format.ts:1-10",
		"src/application/general-wall-project-mutations.ts:181-192",
		"src/ui/room-measurement.ts:28-31",
		"src/ui/room-measurement.ts:46-55",
		"src/ui/room-measurement.ts:60-74",
		"src/ui/room-measurement.ts:87-94",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 90, low: 80 },
};

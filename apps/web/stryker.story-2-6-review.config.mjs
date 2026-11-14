// Focused mutation evidence for Story 2.6: exact consequence discovery,
// explicit Room predecessor selection, safe Wall/Vertex normalization and CAS.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/general-wall-project.test.ts src/application/general-wall-project-mutations.test.ts src/app/project-controller.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/story-2-6-review-mutation.json",
	},
	mutate: [
		"src/domain/general-wall-project.ts:218-222",
		"src/domain/general-wall-project.ts:589-602",
		"src/domain/general-wall-project.ts:682-708",
		"src/domain/general-wall-project.ts:753-806",
		"src/domain/general-wall-project.ts:1660-1756",
		"src/application/general-wall-project-mutations.ts:176-180",
		"src/application/general-wall-project-mutations.ts:269-285",
		"src/application/general-wall-project-mutations.ts:375-423",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 90, low: 80 },
};

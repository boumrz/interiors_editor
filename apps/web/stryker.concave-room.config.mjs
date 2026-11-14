// Focused mutation evidence for a durable concave Room, its inward-offset
// usable polygon, and its exact WebGL floor triangulation. It runs in place;
// do not edit the selected modules while this command is running.
export default {
	commandRunner: {
		command: [
			"node scripts/check-runtime.mjs",
			"./node_modules/.bin/rstest run --config rstest.mutation.config.mjs src/domain/general-wall-project.test.ts src/domain/derived-orthogonal-plan-faces.test.ts src/adapters/renderer/webgl2-room-renderer.test.ts",
		].join(" && "),
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/concave-room-mutation.json",
	},
	mutate: [
		// The graph derivation already proves a simple canonical ring. Mutate the
		// new observable offset and triangulation behavior, not unreachable array
		// guards or the pre-existing polygon metadata checks around it.
		"src/domain/derived-orthogonal-plan-faces.ts:794-800",
		"src/domain/derived-orthogonal-plan-faces.ts:824-832",
		"src/domain/derived-orthogonal-plan-faces.ts:840-845",
		"src/domain/derived-orthogonal-plan-faces.ts:852-853",
		"src/adapters/renderer/webgl2-room-renderer.ts:234-237",
		"src/adapters/renderer/webgl2-room-renderer.ts:247-252",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};

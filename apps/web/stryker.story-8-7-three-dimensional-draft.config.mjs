// Focused mutation evidence for the PWA-update safety signal from a 3D draft.
// Stryker mutates in place; do not edit either selected module while it runs.
export default {
	commandRunner: {
		command: "pnpm exec rstest run src/ui/RoomScene3d.test.tsx",
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/story-8-7-three-dimensional-draft-mutation.json",
	},
	mutate: ["src/ui/RoomScene3d.tsx:103-108"],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
	thresholds: { break: 80, high: 80, low: 70 },
};

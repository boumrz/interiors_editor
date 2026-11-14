export default {
	commandRunner: {
		command:
			"node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/adapters/renderer/webgl2-room-renderer.test.ts src/ui/RoomScene3d.test.tsx",
	},
	concurrency: 1,
	coverageAnalysis: "off",
	inPlace: true,
	jsonReporter: {
		fileName: "reports/mutation/raw-webgl2-baseline-mutation.json",
	},
	mutate: [
		"src/adapters/renderer/webgl2-room-renderer.ts:134-146",
		"src/adapters/renderer/webgl2-room-renderer.ts:302-418",
		"src/ui/RoomScene3d.tsx:226-260",
		"src/ui/RoomScene3d.tsx:900-920",
	],
	packageManager: "pnpm",
	reporters: ["clear-text", "json"],
	testRunner: "command",
};

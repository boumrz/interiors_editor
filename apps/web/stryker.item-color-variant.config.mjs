import productionConfig from "./stryker.config.mjs";

export default {
	...productionConfig,
	commandRunner: {
		command:
			"node scripts/check-runtime.mjs && ./node_modules/.bin/rstest run --config rstest.config.mjs src/domain/recolor-parametric-floor-item.test.ts src/domain/parametric-wall-item.test.ts src/domain/project-json-transfer.test.ts",
	},
	jsonReporter: {
		fileName: "reports/mutation/item-color-variant-mutation.json",
	},
	mutate: [
		"src/domain/item-color-variant.ts",
		"src/domain/parametric-item.ts:472-490",
		"src/domain/parametric-wall-item.ts:250-268",
		"src/domain/project-json-transfer.ts:185-186",
		"src/domain/project-json-transfer.ts:395-397",
		"src/domain/project-json-transfer.ts:422-424",
		"src/domain/project-json-transfer.ts:449-449",
		"src/domain/project-json-transfer.ts:471-473",
	],
};

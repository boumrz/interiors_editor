import { defineConfig } from "@rstest/core";
import { withRspackConfig } from "@rstest/adapter-rspack";

// Stryker replaces TypeScript files in place. Disable Rspack's persistent
// cache for that harness so every mutant, including same-size quick rewrites,
// is compiled rather than accidentally reusing the original module.
export default defineConfig({
	extends: withRspackConfig({
		configPath: "./rspack.shared.config.mjs",
		modifyRspackConfig: (config) => ({ ...config, cache: false }),
		nodeEnv: "test",
	}),
	include: [
		"src/app/**/*.test.ts",
		"src/domain/**/*.test.ts",
		"src/application/**/*.test.ts",
		"src/adapters/**/*.test.ts",
		"src/ui/**/*.test.tsx",
	],
	testEnvironment: "node",
});

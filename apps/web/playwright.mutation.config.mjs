import browserConfig from "./playwright.config.mjs";

export default {
	...browserConfig,
	use: {
		...browserConfig.use,
		baseURL: "http://127.0.0.1:4174",
	},
	webServer: {
		command:
			"pnpm run check:runtime && pnpm exec rspack serve --mode development --config rspack.config.mjs --port 4174",
		reuseExistingServer: false,
		timeout: 30_000,
		url: "http://127.0.0.1:4174",
	},
};

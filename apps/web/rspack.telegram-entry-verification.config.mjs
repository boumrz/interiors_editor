import { fileURLToPath } from "node:url";
import target from "./rspack.telegram.config.mjs";
export default (environment, arguments_) => {
	const configuration = target(environment, arguments_);
	configuration.resolve.alias = {
		...configuration.resolve.alias,
		"./app/telegram-editor-app$": fileURLToPath(new URL("./tests/browser/telegram-historical-entry-fixture.ts", import.meta.url)),
	};
	if (process.env.TMA_ENTRY_NEXT_RELEASE === "true")
		configuration.output = {
			...configuration.output,
			chunkFilename: "[name].next-[contenthash].js",
			cssChunkFilename: "[name].next-[contenthash].css",
		};
	return configuration;
};

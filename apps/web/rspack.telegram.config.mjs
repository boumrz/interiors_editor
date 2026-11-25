import "./scripts/check-runtime.mjs";
import { returnStudyConfiguration } from "./scripts/telegram-analytics-configuration.mjs";
import { resolve } from "node:path";
import { rspack } from "@rspack/core";
import sharedConfiguration from "./rspack.shared.config.mjs";
import { telegramSdkAssetPatterns } from "./scripts/telegram-sdk-asset.mjs";
import { LegalDocumentsPlugin } from "./scripts/legal-documents-build.mjs";
import {
	assertTelegramOutputDirectory,
	telegramPublicConfiguration,
	TelegramReleasePlugin,
} from "./scripts/telegram-release-build.mjs";

export default (environment, arguments_) => {
	const base = sharedConfiguration(environment, arguments_);
	return {
		...base,
		entry: { telegram: "./src/telegram-main.tsx" },
		output: {
			...base.output,
			path: assertTelegramOutputDirectory(
				process.env.INTERIORS_TELEGRAM_OUTPUT ?? resolve("dist-telegram"),
			),
			clean: false,
			filename: "[name].[contenthash].js",
			chunkFilename: "[name].[contenthash].js",
			cssFilename: "[name].[contenthash].css",
			cssChunkFilename: "[name].[contenthash].css",
		},
		plugins: [
			new rspack.DefinePlugin({
				__INTERIORS_TEST_SEAM__: "false",
				__INTERIORS_EXACT_FLOOR_YAW__: JSON.stringify(process.env.INTERIORS_EXACT_FLOOR_YAW === "1"),
				__INTERIORS_DOOR_HINGE_AUTHORING__: JSON.stringify(process.env.INTERIORS_DOOR_HINGE_AUTHORING === "1"),
				__INTERIORS_RETURN_STUDY__: JSON.stringify(returnStudyConfiguration(process.env)),
			}),
			new rspack.HtmlRspackPlugin({
				template: "./public/telegram-index.html",
				title: "InteriorsEditor · Telegram",
			}),
			new rspack.CopyRspackPlugin({
				patterns: [
					...telegramSdkAssetPatterns(),
					{
						from: "../../docs/legal/telegram-support-privacy.html",
						to: "legal/2026-11-24/telegram-support-privacy.html",
					},
					{
						from: "../../docs/legal/telegram-support-direct-privacy.html",
						to: "legal/2026-11-24.2/telegram-support-privacy.html",
					},
					{ from: "./public/icon.svg", to: "icon.svg" },
					{ from: "./public/interiors-lamp-v1.png", to: "interiors-lamp-v1.png" },
					{ from: "./public/catalog", to: "catalog" },
					{
						from: "../catalog-control-plane/src/main/resources/catalog/evidence-assets/*.glb",
						to: "catalog/[name][ext]",
					},
				],
			}),
			new LegalDocumentsPlugin(),
			new TelegramReleasePlugin(telegramPublicConfiguration(process.env)),
		],
		// Preview delivery is explicit and has no SPA fallback or inherited PWA proxy.
		devServer: undefined,
	};
};

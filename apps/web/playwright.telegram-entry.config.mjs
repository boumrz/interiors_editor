import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.TMA_ENTRY_BASE_URL,
	outputDir = process.env.TMA_ENTRY_RESULT_DIR;
if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1" || !outputDir)
	throw new Error("Use the isolated Telegram entry runner");
export default defineConfig({
	testDir: "./tests/browser",
	testMatch: "telegram-entry-e2e.check.ts",
	workers: 1,
	timeout: 45000,
	outputDir,
	reporter: [["list"], ["json", { outputFile: process.env.TMA_ENTRY_REPORT }]],
	use: {
		...devices["iPhone 13"],
		browserName: "chromium",
		channel: "chrome",
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		launchOptions: {
			args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
		},
	},
});

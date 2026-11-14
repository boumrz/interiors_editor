import test from "node:test";
import assert from "node:assert/strict";
import { makePublicConfig } from "./additive-public-config.mjs";
const env = {
	PLAYWRIGHT_TMA_STORAGE_BASE_URL: "http://127.0.0.1:12345",
	ADDITIVE_PUBLIC_OUTPUT: "/owned/run",
	ADDITIVE_PUBLIC_SOURCES: JSON.stringify({ "source.ts": "1".repeat(64) }),
};
test("dedicated configs select only their2/6 family and keep inherited transport bounds", () => {
	for (const [group, file] of [
		["cancellation", "browser-registered-cancellation-e2e.check.ts"],
		["key", "browser-key-public-boundaries-e2e.check.ts"],
	]) {
		const c = makePublicConfig(group, env);
		assert.deepEqual(c.testMatch, [file]);
		assert.equal(c.workers, 1);
		assert.equal(c.retries, 0);
		assert.equal(c.timeout, 10000);
		assert.equal(c.use.channel, "chrome");
		assert.equal(c.metadata.activeMutant, null);
		assert.deepEqual(c.metadata.subjectSelected, []);
		assert.equal(c.metadata.expectedLocalCounts["source.ts"], 0);
	}
});
for (const [name, patch] of [
	["missing output", { ADDITIVE_PUBLIC_OUTPUT: undefined }],
	["foreign host", { PLAYWRIGHT_TMA_STORAGE_BASE_URL: "https://example.com" }],
	["empty sources", { ADDITIVE_PUBLIC_SOURCES: "{}" }],
	[
		"bad hash",
		{ ADDITIVE_PUBLIC_SOURCES: JSON.stringify({ "source.ts": "bad" }) },
	],
])
	test("config refuses " + name, () =>
		assert.throws(() => makePublicConfig("key", { ...env, ...patch })),
	);

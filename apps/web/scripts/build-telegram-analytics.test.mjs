import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { telegramPublicConfiguration } from "./telegram-release-build.mjs";

const editor = "https://domiknote.ru";
const frame =
	"https://analytics.domiknote.ru/launch-v1." + "a".repeat(64) + ".html";
const options = {
	INTERIORS_TELEGRAM_ANALYTICS_DOCUMENT_URL: frame,
	INTERIORS_TELEGRAM_ANALYTICS_COUNTER_ID: "114486792",
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("ordinary release configuration never activates an external personal tracker, including old settings", () => {
	assert.equal(telegramPublicConfiguration({}).analytics, undefined);
	for (const stale of [
		options,
		{ INTERIORS_TELEGRAM_USAGE_METRICS: "server-v1" },
		{ INTERIORS_LOCAL_RETURN_STUDY_FIXTURE: "1" },
	])
		assert.throws(() => telegramPublicConfiguration(stale));
});

test("isolated response is frameable only by approved clients and loads only dedicated scripts", async () => {
	const { analyticsResponseHeaders } = await import(
		"./build-telegram-analytics.mjs"
	);
	const headers = analyticsResponseHeaders(editor, 114486792);
	assert.equal(headers["referrer-policy"], "no-referrer");
	assert.equal(headers["x-content-type-options"], "nosniff");
	const rules = Object.fromEntries(
		headers["content-security-policy"].split("; ").map((rule) => {
			const [name, ...values] = rule.split(" ");
			return [name, values];
		}),
	);
	assert.deepEqual(rules["default-src"], ["'none'"]);
	assert.deepEqual(rules["script-src"], [
		"'self'",
		"https://mc.yandex.ru/metrika/tag.js",
	]);
	assert.deepEqual(rules["frame-ancestors"], [
		editor,
		"https://web.telegram.org",
	]);
	assert.deepEqual(rules["connect-src"], [
		"https://mc.yandex.ru/watch/114486792",
		"https://mc.yandex.com/watch/114486792",
	]);
	assert.deepEqual(rules["img-src"], rules["connect-src"]);
	for (const key of ["frame-src", "base-uri", "form-action"])
		assert.deepEqual(rules[key], ["'none'"]);
	for (const origin of [
		"https://www.domiknote.ru",
		editor + "/foo",
		editor + "?fake",
		"null",
		"http://domiknote.ru",
		"prefix-http://127.0.0.1:8012",
		"http://127.0.0.1:8012/unexpected",
	])
		assert.throws(() => analyticsResponseHeaders(origin, 114486792));
});

test("separate output includes only immutable child JS and HTML bound to the counter and editor", async () => {
	const { buildAnalyticsDocument } = await import(
		"./build-telegram-analytics.mjs"
	);
	const output = await mkdtemp(join(tmpdir(), "tma-analytics-package-"));
	const htmlName = await buildAnalyticsDocument({
		output,
		editorOrigin: editor,
		counterId: "114486792",
	});
	const files = await readdir(output);
	assert.equal(files.length, 2);
	const jsName = files.find((file) => file.endsWith(".js"));
	const js = await readFile(join(output, jsName));
	assert.equal(jsName, `launch-v1.${digest(js)}.js`);
	const html = await readFile(join(output, htmlName), "utf8");
	assert.equal(htmlName, `launch-v1.${digest(html)}.html`);
	assert.match(
		html,
		/<script id="telegram-analytics-config" type="application\/json">/,
	);
	assert.ok(
		html.includes(
			JSON.stringify({ editorOrigin: editor, counterId: 114486792 }),
		),
	);
	assert.ok(html.includes('src="./' + jsName + '"'));
	assert.doesNotMatch(html, /mc\.yandex|noscript|initData/);
});

test("the HTTPS host serves only retained immutable frame files with the verified response policy", async () => {
	const { analyticsNginxSite, analyticsResponseHeaders } = await import(
		"./build-telegram-analytics.mjs"
	);
	const servers = analyticsNginxSite(114486792)
		.split(/^server\s*\{/m)
		.slice(1)
		.map((block) => block.replace(/\s+/g, " "));
	assert.equal(servers.length, 2);
	const [http, https] = servers;
	assert.ok(http.includes("listen 80;"));
	assert.ok(https.includes("listen 443 ssl;"));
	for (const block of servers) {
		assert.ok(block.includes("server_name analytics.domiknote.ru;"));
		assert.ok(block.includes("access_log off;"));
		assert.ok(block.includes("location / { return 404; }"));
	}
	for (const directive of [
		"root /opt/interiors-editor/analytics/retained;",
		"ssl_certificate /etc/letsencrypt/live/interiors-analytics/fullchain.pem;",
		"ssl_certificate_key /etc/letsencrypt/live/interiors-analytics/privkey.pem;",
		"ssl_protocols TLSv1.2 TLSv1.3;",
		'add_header Cache-Control "public, max-age=31536000, immutable";',
		"if ($request_method !~ ^(GET|HEAD)$) { return 405; }",
		"if ($is_args) { return 404; }",
		'location ~ "^/launch-v1\\.[a-f0-9]{64}\\.(html|js)$" { try_files $uri =404; }',
	])
		assert.ok(https.includes(directive), directive);
	for (const [name, value] of Object.entries(
		analyticsResponseHeaders(editor, 114486792),
	))
		assert.ok(https.includes(`add_header ${name} "${value}" always;`));
});

test("the ordinary build computes the form digest and supports independent early termination", async () => {
	const { returnStudyConfiguration } = await import(
		"./telegram-analytics-configuration.mjs"
	);
	const html = await readFile(
		new URL("../../../docs/legal/analytics-consent.html", import.meta.url),
	);
	assert.deepEqual(returnStudyConfiguration({}), {
		active: true,
		digest: digest(html),
	});
	assert.equal(
		returnStudyConfiguration({ INTERIORS_STOP_REPEAT_STUDY: "1" }).active,
		false,
	);
});
test("the ordinary packaging job uses default daily totals without retired fixture overrides", async () => {
	const workflow = await readFile(
		new URL("../../../.github/workflows/verify.yml", import.meta.url),
		"utf8",
	);
	const job = workflow
		.split("name: Build the configured Telegram production target")[1]
		.split("- name:")[0];
	assert.doesNotMatch(
		job,
		/INTERIORS_(TELEGRAM_USAGE_METRICS|LOCAL_RETURN_STUDY_FIXTURE)/,
	);
	assert.equal(telegramPublicConfiguration({}).usageMetrics, undefined);
});

import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { rspack } from "@rspack/core";
import {
	validateAnalyticsCounter,
	validateAnalyticsEditorOrigin,
} from "./telegram-analytics-configuration.mjs";

export function analyticsResponseHeaders(editorOrigin, counterId) {
	const editor = validateAnalyticsEditorOrigin(editorOrigin);
	const id = validateAnalyticsCounter(counterId);
	const collection = `https://mc.yandex.ru/watch/${id} https://mc.yandex.com/watch/${id}`;
	return {
		"referrer-policy": "no-referrer",
		"x-content-type-options": "nosniff",
		"content-security-policy": [
			"default-src 'none'",
			"script-src 'self' https://mc.yandex.ru/metrika/tag.js",
			`connect-src ${collection}`,
			`img-src ${collection}`,
			"frame-src 'none'",
			"base-uri 'none'",
			"form-action 'none'",
			`frame-ancestors ${editor} https://web.telegram.org`,
		].join("; "),
	};
}

export function analyticsNginxSite(counterId) {
	const security = Object.entries(
		analyticsResponseHeaders("https://domiknote.ru", counterId),
	)
		.map(([name, value]) => `    add_header ${name} "${value}" always;`)
		.join("\n");
	return `server {
    listen 80;
    listen [::]:80;
    server_name analytics.domiknote.ru;
    access_log off;
    location ^~ /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 404; }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name analytics.domiknote.ru;
    ssl_certificate /etc/letsencrypt/live/interiors-analytics/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/interiors-analytics/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    access_log off;
    error_log /dev/null crit;
    root /opt/interiors-editor/analytics/retained;
    add_header Cache-Control "public, max-age=31536000, immutable";
    if ($request_method !~ ^(GET|HEAD)$) { return 405; }
    if ($is_args) { return 404; }
${security}
    location ~ "^/launch-v1\\.[a-f0-9]{64}\\.(html|js)$" {
        try_files $uri =404;
    }
    location / { return 404; }
}
`;
}

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = fileURLToPath(new URL("../", import.meta.url));

export async function buildAnalyticsDocument({
	output,
	editorOrigin,
	counterId,
}) {
	const config = {
		editorOrigin: validateAnalyticsEditorOrigin(editorOrigin),
		counterId: validateAnalyticsCounter(counterId),
	};
	const staging = await mkdtemp(join(tmpdir(), "interiors-analytics-build-"));
	try {
		const compiler = rspack({
			context: root,
			mode: "production",
			devtool: false,
			entry: "./src/telegram-analytics-main.ts",
			resolve: { extensions: [".ts", ".js"] },
			module: {
				rules: [
					{
						test: /\.ts$/,
						type: "javascript/auto",
						loader: "builtin:swc-loader",
						options: {
							jsc: { parser: { syntax: "typescript" }, target: "es2022" },
						},
					},
				],
			},
			output: { path: staging, filename: "launch.js" },
		});
		try {
			const stats = await new Promise((resolve, reject) =>
				compiler.run((error, result) =>
					error ? reject(error) : resolve(result),
				),
			);
			if (stats.hasErrors())
				throw new Error(stats.toString({ all: false, errors: true }));
		} finally {
			await new Promise((resolve, reject) =>
				compiler.close((error) => (error ? reject(error) : resolve())),
			);
		}
		const js = await readFile(join(staging, "launch.js"));
		const jsName = `launch-v1.${digest(js)}.js`;
		const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Статистика запуска</title></head>
<body><script id="telegram-analytics-config" type="application/json">${JSON.stringify(config)}</script>
<script src="./${jsName}" defer></script></body></html>
`;
		const htmlName = `launch-v1.${digest(html)}.html`;
		await mkdir(output, { recursive: true });
		await writeFile(join(output, jsName), js);
		await writeFile(join(output, htmlName), html);
		return htmlName;
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const { values } = parseArgs({
		options: {
			output: { type: "string" },
			"editor-origin": { type: "string" },
			"counter-id": { type: "string" },
		},
	});
	const file = await buildAnalyticsDocument({
		output: values.output,
		editorOrigin: values["editor-origin"],
		counterId: values["counter-id"],
	});
	console.log(file);
}

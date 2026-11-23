import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createTelegramPreviewServer } from "./telegram-preview-server.mjs";

const web = fileURLToPath(new URL("../", import.meta.url));
const source = new URL("../../../docs/legal/", import.meta.url);
const names = ["privacy-policy", "license-agreement", "analytics-consent"];
const edition = "2026-11-22.2";

test("Telegram publishes the unmodified legal editions, provides prelaunch reading and permits saving without JavaScript", {
	timeout: 60_000,
}, async (t) => {
	const temporary = await mkdtemp(join(tmpdir(), "interiors-legal-delivery-"));
	t.after(() => rm(temporary, { recursive: true, force: true }));
	const output = join(temporary, "dist-telegram");
	const build = spawnSync(
		process.execPath,
		[
			"node_modules/@rspack/cli/bin/rspack.js",
			"build",
			"--mode",
			"production",
			"--config",
			"rspack.telegram.config.mjs",
		],
		{
			cwd: web,
			env: { ...process.env, INTERIORS_TELEGRAM_OUTPUT: output },
			encoding: "utf8",
			timeout: 45_000,
		},
	);
	assert.equal(build.status, 0, build.stdout + build.stderr);
	const preview = await createTelegramPreviewServer({ directory: output });
	t.after(() => preview.close());
	await new Promise((resolve) =>
		preview.server.listen(0, "127.0.0.1", resolve),
	);
	const origin = "http://127.0.0.1:" + preview.server.address().port;
	const browser = await chromium.launch({ channel: "chrome" });
	t.after(() => browser.close());
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	const api = [];
	page.on("request", (request) => api.push(request.url()));
	await page.goto(origin);
	for (const name of names) {
		const path = "/legal/" + name + ".html";
		const body = await readFile(new URL(name + ".html", source), "utf8");
		const anchor = page.locator('a[href="' + path + '"]');
		assert.equal(await anchor.count(), 1, "missing pre-launch link " + name);
		await anchor.click();
		assert.equal(await page.locator("h1").count(), 1);
		assert.equal(await page.locator("#root").count(), 0);
		await page.goBack();
		for (const [url, cache] of [
			[path, "no-store"],
			[
				"/legal/" + edition + "/" + name + ".html",
				"public, max-age=31536000, immutable",
			],
		]) {
			const response = await fetch(origin + url);
			assert.equal(response.status, 200, url);
			assert.match(response.headers.get("content-type"), /text\/html/);
			assert.equal(response.headers.get("cache-control"), cache);
			assert.equal(await response.text(), body);
		}
	}
	assert.ok(
		api.every(
			(url) => new URL(url).origin === origin && !url.includes("/stats/"),
		),
	);
	assert.equal((await fetch(origin + "/legal/legal-review.md")).status, 404);
	await preview.activate(output);
});

test("the offline reader preserves the underlying screen with the same edition on local and HTTPS origins", {
	timeout: 60_000,
}, async (t) => {
	const { rspack } = await import("@rspack/core");
	const { default: configure } = await import("../rspack.config.mjs");
	const config = configure({}, { mode: "production" });
	const temporary = await mkdtemp(join(tmpdir(), "interiors-legal-reader-"));
	t.after(() => rm(temporary, { recursive: true, force: true }));
	config.context = web;
	config.entry = "./tests/browser/legal-reader-fixture.tsx";
	config.output = { ...config.output, path: temporary };
	const compiler = rspack(config);
	await new Promise((resolve, reject) =>
		compiler.run((err, stats) =>
			compiler.close(() => {
				if (err || stats.hasErrors())
					reject(err || new Error(stats.toString({ errors: true })));
				else resolve();
			}),
		),
	);
	const browser = await chromium.launch({ channel: "chrome" });
	t.after(() => browser.close());
	for (const origin of ["http://127.0.0.1:37773", "https://example.invalid"]) {
		const context = await browser.newContext();
		try {
			await context.route("**/*", async (route) => {
				const url = new URL(route.request().url());
				assert.equal(url.origin, origin);
				const path =
					url.pathname === "/" ? "index.html" : url.pathname.slice(1);
				await route.fulfill({ path: join(temporary, path) });
			});
			const page = await context.newPage();
			await page.goto(origin);
			assert.equal(await page.getByTestId("release").textContent(), edition);
			assert.equal(await page.getByTestId("readable").textContent(), "true");
			await page.getByRole("textbox").fill("сохранено");
			const link = page.getByRole("link", { name: "Прочитать политику" });
			assert.equal(
				await link.getAttribute("href"),
				`/legal/${edition}/privacy-policy.html`,
			);
			await context.unrouteAll();
			const unexpectedRequests = [];
			context.on("request", (request) =>
				unexpectedRequests.push(request.url()),
			);
			await context.setOffline(true);
			await link.click();
			const dialog = page.getByRole("dialog");
			await dialog
				.getByRole("heading", { level: 1, name: /Политика/ })
				.waitFor();
			assert.equal(await dialog.locator("iframe").count(), 0);
			await dialog
				.locator("footer")
				.getByRole("link", { name: /Лицензионное соглашение/ })
				.click();
			await dialog
				.getByRole("heading", { level: 1, name: /Лицензионное соглашение/ })
				.waitFor();
			const download = page.waitForEvent("download");
			await dialog.getByRole("link", { name: "Сохранить HTML" }).click();
			assert.equal(
				await readFile(await (await download).path(), "utf8"),
				await readFile(new URL("license-agreement.html", source), "utf8"),
			);
			await page.evaluate(() =>
				window.dispatchEvent(new Event("test-native-back")),
			);
			await dialog
				.getByRole("heading", { level: 1, name: /Политика/ })
				.waitFor();
			await dialog.getByRole("button", { name: "Назад", exact: true }).click();
			await dialog.waitFor({ state: "hidden" });
			assert.equal(await page.getByRole("textbox").inputValue(), "сохранено");
			assert.equal(
				await link.evaluate((el) => document.activeElement === el),
				true,
			);
			assert.deepEqual(
				unexpectedRequests.filter((url) => !url.startsWith("blob:")),
				[],
			);
		} finally {
			await context.close();
		}
	}
});

test("an active PWA worker refreshes the three stable legal URLs and preserves their last valid offline copies", {timeout:30000}, async t=>{
 const texts=Object.fromEntries(await Promise.all(names.map(async n=>[n,await readFile(new URL(n+".html",source),"utf8")])));
 const shell=names.flatMap(n=>["/legal/"+n+".html","/legal/old/"+n+".html"]);
 const template=await readFile(join(web,"public/sw.template.js"),"utf8");
 const worker=template.replace("__INTERIORS_APP_SHELL_CACHE__","interiors-editor-shell-fixed").replace("__INTERIORS_BROWSE_CACHE__","interiors-editor-browse-fixed").replace("__INTERIORS_APP_SHELL__",JSON.stringify(shell)).replace("__INTERIORS_RELEASE_MANIFEST__","{}");
 let stage="previous";
 const server=createServer((req,res)=>{
  const path=new URL(req.url,"http://localhost").pathname;
  if(path==="/sw.js"){res.writeHead(200,{"Content-Type":"text/javascript"});return res.end(worker);}
  if(path==="/"){res.writeHead(200,{"Content-Type":"text/html"});return res.end("<title>Test</title>");}
  const n=names.find(name=>path.endsWith("/"+name+".html"));
  if(!n){res.writeHead(404);return res.end();}
  const archived=path.startsWith("/legal/old/");
  const html=(stage==="spa" ? "<!doctype html><html><body><main><h1>InteriorsEditor</h1></main></body></html>" : stage==="wrong-doc" ? texts[n==="privacy-policy"?"license-agreement":"privacy-policy"] : texts[n])+"<!--"+(archived?"archive":stage)+"-->";
  res.writeHead(stage==="404"?404:stage==="500"?500:200,{"Content-Type":stage==="wrong-type"?"application/json":"text/html; charset=utf-8","Cache-Control":"no-store"});
  res.end(html);
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));t.after(()=>new Promise(done=>server.close(done)));
 const browser=await chromium.launch({channel:"chrome"});t.after(()=>browser.close());
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto("http://127.0.0.1:"+server.address().port);
 await page.evaluate(async()=>{await navigator.serviceWorker.register("/sw.js");await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const get=path=>page.evaluate(async url=>{try{return await (await fetch(url)).text();}catch{return null;}},path);
 stage="current";
 for(const n of names){assert.match(await get("/legal/"+n+".html"),/<!--current-->/);assert.match(await get("/legal/old/"+n+".html"),/<!--archive-->/);}
 for(stage of ["404","500","spa","wrong-doc","wrong-type"]){
  for(const n of names)assert.match(await get("/legal/"+n+".html"),/<!--current-->/,stage+" must keep "+n);
 }
 await context.setOffline(true);
 for(const n of names)assert.match(await get("/legal/"+n+".html"),/<!--current-->/);
 await page.evaluate(async()=>{const cache=await caches.open("interiors-editor-shell-fixed");await cache.put("/legal/license-agreement.html",new Response("<main><h1>InteriorsEditor</h1></main>",{headers:{"Content-Type":"text/html"}}));});
 assert.equal(await get("/legal/license-agreement.html"),null,"a corrupt offline copy never serves the editor shell");
});

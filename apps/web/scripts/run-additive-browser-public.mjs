import {
	readFile,
	readdir,
	mkdir,
	mkdtemp,
	writeFile,
	lstat,
	realpath,
} from "node:fs/promises";
import { writeFileSync, renameSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
	groupPlan,
	requireInvocation,
	baselineEnvironment,
	sha,
	bytesManifest,
	requireSameManifest,
	qualifyBaseline,
	requireBuildOutput,
	requireRuntimePins,
} from "./additive-public-contract.mjs";
import { runCommand, createStop } from "./additive-owned-command.mjs";
import { processRows } from "./owned-qualification-child.mjs";
const app = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
	require = createRequire(app + "/package.json");
const PNPM =
	"/Users/romanzheltov/.npm/_npx/90ee57dca4845993/node_modules/pnpm/bin/pnpm.cjs";
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const canonical = (path) =>
	String(path)
		.replace(/^\/private\/var\//, "/var/")
		.replace(/^\/private\/tmp\//, "/tmp/");
const invalid = (message) => Error("ADDITIVE_PUBLIC_PROOF_INVALID: " + message);
const arg = (name) => {
	const i = process.argv.indexOf(name);
	return i >= 2 ? process.argv[i + 1] : undefined;
};
function save(file, data) {
	const temporary = file + ".tmp";
	writeFileSync(temporary, JSON.stringify(data, null, 2) + "\n");
	renameSync(temporary, file);
}
async function inputs() {
	const files = {};
	async function add(file, key = file) {
		const st = await lstat(file);
		if (!st.isFile() || st.isSymbolicLink())
			throw invalid("nonregular protected input " + file);
		files[key] = sha(await readFile(file));
	}
	async function walk(dir) {
		for (const e of await readdir(resolve(app, dir), { withFileTypes: true })) {
			const key = dir + "/" + e.name;
			if (e.isDirectory()) await walk(key);
			else if (e.isFile()) await add(resolve(app, key), key);
			else throw invalid("nonregular source tree member");
		}
	}
	for (const dir of ["src", "tests", "scripts", "public"]) await walk(dir);
	for (const e of await readdir(app, { withFileTypes: true }))
		if (e.isFile() && /\.(?:mjs|json|ya?ml|html)$/.test(e.name))
			await add(resolve(app, e.name), e.name);
	for (const name of [
		"package.json",
		"pnpm-lock.yaml",
		"pnpm-workspace.yaml",
		".npmrc",
		"contracts/catalog-control-plane/fixtures/media-cases.json",
		"contracts/catalog-control-plane/fixtures/catalog-envelope-v1.valid.json",
		"apps/catalog-control-plane/src/main/resources/catalog/catalog-envelope-source.json",
		"apps/catalog-control-plane/src/main/resources/catalog/catalog-resource-files-v1.json",
		...[
			"evidence-floor-vase.glb",
			"evidence-bathroom-sink.glb",
			"evidence-countertop-appliance.glb",
			"evidence-wall-sconce.glb",
		].map(
			(n) =>
				"apps/catalog-control-plane/src/main/resources/catalog/evidence-assets/" +
				n,
		),
	]) {
		const file = resolve(app, "../..", name);
		await add(file);
	}
	for (const file of [process.execPath, PNPM, "/bin/ps", "/usr/sbin/lsof"])
		files[file] = sha(await readFile(file));
	const { readFormatterBinding } = await import(
		"./factory-native-error-binding.mjs"
	);
	const actualRuntime = { ...readFormatterBinding() };
	const rspackPackage = require.resolve("@rspack/cli/package.json");
	for (const file of [
		process.execPath,
		PNPM,
		"/bin/ps",
		"/usr/sbin/lsof",
		rspackPackage,
		join(dirname(rspackPackage), "bin/rspack.js"),
	])
		actualRuntime[file] = sha(await readFile(file));
	requireRuntimePins(
		await json(app + "/tests/verification/browser-public-runtime-hashes.json"),
		actualRuntime,
	);
	Object.assign(files, actualRuntime);
	return files;
}
async function manifest(dist) {
	const files = {};
	async function walk(dir, prefix = "") {
		for (const e of await readdir(dir, { withFileTypes: true })) {
			const name = prefix + e.name,
				file = join(dir, e.name);
			if (e.isDirectory()) await walk(file, name + "/");
			else {
				const st = await lstat(file);
				if (!st.isFile() || st.isSymbolicLink())
					throw invalid("nonregular emitted file");
				files[name] = await readFile(file);
			}
		}
	}
	await walk(dist);
	return bytesManifest(files);
}
function flatten(s) {
	return [...(s.specs ?? []), ...(s.suites ?? []).flatMap(flatten)];
}
export async function execute({ group, mode, output, lease } = {}) {
	const definition = groupPlan(group);
	requireInvocation({ group, native: mode === "native", lease });
	if (!["discover", "build-only", "native"].includes(mode))
		throw invalid("explicit discover/build-only/native mode required");
	if (
		process.version !== "v24.19.0" ||
		execFileSync(process.execPath, [PNPM, "--version"], {
			encoding: "utf8",
			timeout: 5000,
		}).trim() !== "11.20.0"
	)
		throw invalid("pinned Node24.19.0/pnpm11.20.0 required");
	const root = output
		? resolve(output)
		: await mkdtemp("/tmp/interiors-additive-public-" + group + "-");
	if (root === app || root.startsWith(app + sep))
		throw invalid("result directory must be outside app input tree");
	if (output) {
		await mkdir(root, { recursive: true });
		if ((await readdir(root)).length)
			throw invalid("result directory must be new/empty");
	}
	const state = {
			version: 1,
			group,
			mode,
			root,
			app,
			NativeExecuted: false,
			wholeAccepted: false,
			score: null,
			qualified: false,
			records: [],
			issues: [],
		},
		stop = createStop(),
		initial = await inputs(),
		sources = {};
	let server,
		initialEmitted,
		served = [],
		finalError;
	const persist = () => save(root + "/run.json", state),
		onSignal = (signal) => {
			state.interrupted = true;
			stop.request(signal);
			persist();
		};
	const sigint = () => onSignal("SIGINT"),
		sigterm = () => onSignal("SIGTERM");
	process.on("SIGINT", sigint);
	process.on("SIGTERM", sigterm);
	try {
		const paths = await json(
				app + "/tests/verification/browser-public-native-subjects.json",
			),
			expectedHashes = await json(
				app + "/tests/verification/browser-public-source-hashes.json",
			);
		for (const [name, path] of Object.entries(paths)) {
			const bytes = await readFile(app + "/" + path);
			if (/function\s+stryNS_[A-Za-z0-9_$]+\s*\(/.test(bytes.toString()))
				throw invalid("baseline requires unchanged plain Source " + path);
			sources[name] = sha(bytes);
			if (sources[name] !== expectedHashes[name])
				throw invalid("pinned current candidate Source drift " + path);
		}
		if (Object.keys(sources).length !== 10)
			throw invalid("exact ten source modules");
		state.sources = sources;
		save(root + "/initial-inputs.json", initial);
		const env = {
			...baselineEnvironment(process.env, root),
			ADDITIVE_PUBLIC_GROUP: group,
			ADDITIVE_PUBLIC_OUTPUT: root,
			ADDITIVE_PUBLIC_SOURCES: JSON.stringify(sources),
			FACTORY_NATIVE_RAW_ERRORS_LEDGER: root + "/raw-errors.jsonl",
			PLAYWRIGHT_TMA_STORAGE_BASE_URL: "http://127.0.0.1:1",
		};
		const pw = require.resolve("@playwright/test/cli"),
			rspack = join(
				dirname(require.resolve("@rspack/cli/package.json")),
				"bin/rspack.js",
			);
		async function command(label, entry, args) {
			stop.assertCanStart();
			const record = { label };
			state.records.push(record);
			persist();
			const child = await runCommand({
				entry,
				args,
				cwd: app,
				env,
				stop,
				ownedRoot: root,
				timeoutMs: 120000,
				onRecord: (r) => {
					Object.assign(record, r);
					if (label === "native" && r.events.some((e) => e.phase === "spawn"))
						state.NativeExecuted = true;
					persist();
				},
			});
			Object.assign(record, {
				child: { ...child, text: undefined },
				code: child.code,
			});
			await writeFile(root + "/" + label + ".log", child.text ?? "");
			persist();
			if (
				child.observerError ||
				!child.running.closedProven ||
				child.timedOut ||
				child.signal !== null ||
				child.code !== 0 ||
				stop.interrupted
			)
				throw invalid(label + " actual CLI/EXIT/CLOSE failed");
			return child;
		}
		const discovery = await command("discover", pw, [
			"test",
			"--config",
			definition.config,
			"--list",
			"--reporter=json",
		]);
		const discovered = JSON.parse(discovery.text),
			plan = flatten(discovered).map((s) =>
				Object.fromEntries(
					["id", "file", "title", "line", "column"].map((k) => [k, s[k]]),
				),
			);
		if (
			discovered.errors?.length ||
			plan.length !== definition.count ||
			new Set(plan.map((s) => s.id)).size !== definition.count
		)
			throw invalid("dedicated discovery count/identity");
		state.plan = plan;
		save(root + "/plan.json", plan);
		if (mode === "discover") {
			state.state = "discovery-only";
		} else {
			const build = await command("build", rspack, [
				"build",
				"--config",
				"rspack.browser-public-verification.config.mjs",
				"--mode",
				"development",
			]);
			requireBuildOutput({ code: build.code, text: build.text });
			initialEmitted = await manifest(root + "/dist");
			if (
				!initialEmitted["index.html"]?.bytes ||
				!Object.keys(initialEmitted).some(
					(name) => name.endsWith(".js") && initialEmitted[name].bytes > 0,
				)
			)
				throw invalid("complete HTML/JS emitted bundle required");
			save(root + "/initial-emitted-manifest.json", initialEmitted);
			if (mode === "build-only") state.state = "build-only-no-native";
			else {
				server = createServer(async (req, res) => {
					try {
						const name =
							decodeURIComponent(
								new URL(req.url, "http://127.0.0.1").pathname,
							).replace(/^\//, "") || "index.html";
						if (!Object.hasOwn(initialEmitted, name)) {
							res.statusCode = 404;
							res.end();
							return;
						}
						const bytes = await readFile(root + "/dist/" + name);
						requireSameManifest(
							{ [name]: initialEmitted[name] },
							bytesManifest({ [name]: bytes }),
						);
						served.push({ file: name, ...initialEmitted[name] });
						res.setHeader(
							"Content-Type",
							name.endsWith(".html")
								? "text/html"
								: name.endsWith(".js")
									? "application/javascript"
									: name.endsWith(".css")
										? "text/css"
										: "application/octet-stream",
						);
						res.end(bytes);
					} catch (error) {
						state.issues.push("served bytes " + String(error));
						res.statusCode = 500;
						res.end();
					}
				});
				await new Promise((finish, fail) => {
					server.once("error", fail);
					server.listen(0, "127.0.0.1", finish);
				});
				env.PLAYWRIGHT_TMA_STORAGE_BASE_URL =
					"http://127.0.0.1:" + server.address().port;
				const { bindFactoryNativeErrors, readFormatterBinding } = await import(
						"./factory-native-error-binding.mjs"
					),
					formatter = readFormatterBinding();
				save(root + "/formatter-before.json", formatter);
				const native = await command("native", pw, [
					"test",
					"--config",
					definition.config,
				]);
				const report = await json(root + "/report.json"),
					raw = (await readFile(root + "/raw-errors.jsonl", "utf8"))
						.split("\n")
						.filter(Boolean)
						.map(JSON.parse),
					rows = (await readFile(root + "/activation.jsonl", "utf8"))
						.split("\n")
						.filter(Boolean)
						.map(JSON.parse),
					rawMeta = await json(root + "/raw-errors.jsonl.meta.json"),
					rawEnd = await json(root + "/raw-errors.jsonl.terminal.json");
				const binding = bindFactoryNativeErrors({
					report,
					rawErrors: raw,
					expectedCliPid: native.pid,
					expectedFormatterBinding: formatter,
				});
				if (
					rawMeta.cliPid !== native.pid ||
					rawEnd.cliPid !== native.pid ||
					rawEnd.status !== "passed" ||
					JSON.stringify(rawMeta.formatterBinding) !==
						JSON.stringify(formatter) ||
					JSON.stringify(rawEnd.formatterBinding) !== JSON.stringify(formatter)
				)
					throw invalid("raw reporter terminal/dependency identity");
				state.baseline = qualifyBaseline({
					report,
					rows,
					plan,
					sources,
					rawBinding: binding,
					native,
				});
				if (!state.baseline.valid)
					throw invalid(state.baseline.issues.join(","));
				if (!served.length) throw invalid("no actual served bytes");
				state.state = "dedicated-baseline-clean";
				state.qualified = true;
			}
		}
	} catch (error) {
		state.issues.push(String(error));
		state.state = "invalid-infrastructure";
		state.qualified = false;
		finalError = error;
	} finally {
		if (server)
			try {
				await Promise.race([
					new Promise((finish, fail) =>
						server.close((error) => (error ? fail(error) : finish())),
					),
					new Promise((_, fail) => {
						const timer = setTimeout(
							() => fail(invalid("technical server close pending")),
							2500,
						);
						timer.unref();
					}),
				]);
			} catch (error) {
				server.closeAllConnections();
				state.issues.push(String(error));
				state.qualified = false;
			}
		try {
			const current = await inputs();
			state.finalInputsMatch =
				JSON.stringify(Object.entries(initial).sort()) ===
				JSON.stringify(Object.entries(current).sort());
			if (!state.finalInputsMatch) {
				state.issues.push(String(invalid("full input closure changed")));
				state.qualified = false;
			}
			save(root + "/final-inputs.json", current);
			if (initialEmitted) {
				const actual = await manifest(root + "/dist");
				requireSameManifest(initialEmitted, actual);
				save(root + "/final-emitted-manifest.json", actual);
			}
			save(root + "/served-byte-ledger.json", served);
		} catch (error) {
			state.issues.push(String(error));
			state.qualified = false;
		}
		state.remaining = processRows().filter(
			(row) =>
				row.pid !== process.pid &&
				row.pid !== process.ppid &&
				state.records.some(
					(r) =>
						r.running &&
						(row.pgid === r.running.pgid ||
							canonical(row.command).includes(canonical(root) + "/")),
				),
		);
		if (state.remaining.length || stop.interrupted) {
			state.issues.push("physical ownership/interruption unproven");
			state.qualified = false;
		}
		if (state.issues.length) state.state = "invalid-infrastructure";
		persist();
		process.off("SIGINT", sigint);
		process.off("SIGTERM", sigterm);
	}
	return {
		result: root + "/run.json",
		group,
		state: state.state,
		qualified: state.qualified,
		NativeExecuted: state.NativeExecuted,
		wholeAccepted: false,
		score: null,
		issues: state.issues,
	};
}
if (
	process.argv[1] &&
	(await realpath(process.argv[1]).catch(() => null)) ===
		(await realpath(fileURLToPath(import.meta.url)).catch(() => null))
) {
	try {
		const result = await execute({
			group: arg("--group"),
			mode: process.argv.includes("--discover")
				? "discover"
				: process.argv.includes("--build-only")
					? "build-only"
					: process.argv.includes("--native")
						? "native"
						: undefined,
			output: arg("--output"),
			lease: arg("--root-lease"),
		});
		console.log("Owned additive public proof: " + JSON.stringify(result));
		process.exitCode = result.issues.length ? 2 : 0;
	} catch (error) {
		console.error(String(error));
		process.exitCode = 2;
	}
}

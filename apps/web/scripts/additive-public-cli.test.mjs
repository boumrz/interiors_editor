import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const file = fileURLToPath(
	new URL("./run-additive-browser-public.mjs", import.meta.url),
);
test("actual CLI executes through both OS aliases and refuses Native lease before missing output/input work", async () => {
	for (const entry of [file, file.replace(/^\/private\/var\//, "/var/")]) {
		const env = { ...process.env };
		delete env.ADDITIVE_PUBLIC_NATIVE_SLOT;
		const child = spawn(
			process.execPath,
			[
				entry,
				"--group",
				"key",
				"--native",
				"--output",
				"/missing/must-not-create",
			],
			{ env, stdio: ["ignore", "pipe", "pipe"] },
		);
		let text = "";
		for (const s of [child.stdout, child.stderr])
			s.on("data", (b) => (text += b));
		const code = await new Promise((r) => child.once("close", r));
		assert.equal(code, 2);
		assert.match(text, /explicit Root Native lease/);
		assert.doesNotMatch(text, /ENOENT/);
	}
});

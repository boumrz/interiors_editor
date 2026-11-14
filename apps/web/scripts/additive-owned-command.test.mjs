import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { runCommand, createStop } from "./additive-owned-command.mjs";
test("actual Node child records spawn EXIT CLOSE and genuine owned terminal (no browser)", async () => {
	const cwd = await mkdtemp("/tmp/additive-command-cpu-");
	try {
		const entry = cwd + "/child.mjs";
		await writeFile(entry, 'console.log("actual CPU child")');
		const r = await runCommand({
			entry,
			args: [],
			cwd,
			env: process.env,
			stop: createStop(),
			ownedRoot: cwd,
			timeoutMs: 5000,
		});
		assert.equal(r.code, 0);
		assert.equal(r.closed, true);
		assert.equal(r.pipeAbandonment ?? false, false);
		assert.deepEqual(
			r.events.map((e) => e.phase),
			["spawn", "exit", "close"],
		);
		assert.equal(r.running.closedProven, true);
		assert.deepEqual(r.ownership.remaining, []);
		assert.match(r.text, /actual CPU child/);
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
});
test("sticky stop refuses the next executable before spawn", async () => {
	const stop = createStop();
	stop.request("manual");
	await assert.rejects(
		runCommand({
			entry: "/missing",
			args: [],
			cwd: "/tmp",
			env: process.env,
			stop,
			ownedRoot: "/tmp/no-owned-profile",
			timeoutMs: 1,
		}),
		/no next/,
	);
});

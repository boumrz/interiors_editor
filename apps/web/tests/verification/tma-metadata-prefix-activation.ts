import { afterAll, beforeAll, beforeEach, expect } from "@rstest/core";
import "../../src/adapters/persistence/telegram-scope-store";
import "../../src/app/telegram-runtime-session";

const processValue = Reflect.get(globalThis, "process"),
	env = processValue.env;
async function files() {
	const name = "node:fs";
	return import(name);
}
let owns = false;
beforeAll(async () => {
	const fs = await files();
	try {
		fs.writeFileSync(
			`${env.TMA_META_PREFIX_INVOCATION}/worker.owner`,
			String(processValue.pid),
			{ flag: "wx" },
		);
		owns = true;
		fs.appendFileSync(
			`${env.TMA_META_PREFIX_INVOCATION}/workers.jsonl`,
			`${JSON.stringify({ kind: "begin", pid: processValue.pid })}\n`,
		);
		if (env.TMA_META_PREFIX_GLOBAL_ONLY === "1")
			throw new Error("CONTROL_GLOBAL_ONLY");
	} catch (cause) {
		throw new Error("TMA_METADATA_PREFIX_INVALID: worker ownership", { cause });
	}
});
afterAll(async () => {
	if (!owns) return;
	const fs = await files();
	try {
		if (
			fs.readFileSync(
				`${env.TMA_META_PREFIX_INVOCATION}/worker.owner`,
				"utf8",
			) !== String(processValue.pid)
		)
			throw new Error("foreign cleanup");
		fs.unlinkSync(`${env.TMA_META_PREFIX_INVOCATION}/worker.owner`);
		fs.appendFileSync(
			`${env.TMA_META_PREFIX_INVOCATION}/workers.jsonl`,
			`${JSON.stringify({ kind: "end", pid: processValue.pid })}\n`,
		);
		owns = false;
	} catch (cause) {
		throw new Error("TMA_METADATA_PREFIX_INVALID: worker cleanup", { cause });
	}
});
beforeEach(async (context) => {
	const fs = await files(),
		expected = JSON.parse(env.TMA_META_PREFIX_SOURCE_SHAS),
		active =
			env.TMA_META_PREFIX_POISON_ID === "1"
				? "wrong-local-id"
				: (env.__STRYKER_ACTIVE_MUTANT__ ?? null),
		selected = env.TMA_META_PREFIX_SELECTED,
		markers = Reflect.get(globalThis, "__TMA_META_PREFIX_SUBJECTS__");
	const actual = Object.fromEntries(
		Object.keys(expected).map((file) => {
			const marker = markers?.[file];
			return [
				file,
				{
					sha: marker?.sha ?? null,
					instrumented: marker?.instrumented ?? false,
					active: marker?.readActive() ?? null,
					hasActive: marker?.localIDs?.includes(active) ?? false,
				},
			];
		}),
	);
	const valid = Object.entries(expected).every(([file, sha]) => {
		const item = actual[file];
		return (
			item.sha === sha &&
			item.active === (file === selected ? active : null) &&
			(file === selected
				? active === null || (item.instrumented && item.hasActive)
				: !item.instrumented && !item.hasActive)
		);
	});
	const row = {
		testId: context.task.id,
		file: context.task.filepath,
		title: expect.getState().currentTestName ?? context.task.name,
		pid: processValue.pid,
		active,
		actual,
		valid,
	};
	fs.appendFileSync(
		`${env.TMA_META_PREFIX_INVOCATION}/activation.jsonl`,
		`${JSON.stringify(row)}\n`,
	);
	if (!valid)
		throw new Error(
			"TMA_METADATA_PREFIX_INVALID: actual source/local namespace membership",
		);
});

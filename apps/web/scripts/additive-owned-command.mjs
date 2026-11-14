import {
	runOwnedChild,
	signalOwnedGroup,
	processRows,
} from "./owned-qualification-child.mjs";
export function createStop() {
	let interrupted = false,
		current;
	return {
		get interrupted() {
			return interrupted;
		},
		get current() {
			return current;
		},
		set current(v) {
			current = v;
		},
		assertCanStart() {
			if (interrupted)
				throw Error(
					"ADDITIVE_PUBLIC_PROOF_INVALID: interrupted, no next command",
				);
		},
		request() {
			interrupted = true;
			if (current?.signal) signalOwnedGroup(current, "SIGTERM");
		},
	};
}
export async function runCommand({
	entry,
	args,
	cwd,
	env,
	stop,
	ownedRoot,
	timeoutMs = 120000,
	onRecord = () => {},
}) {
	stop.assertCanStart();
	const events = [],
		pending = runOwnedChild({
			entry: process.execPath,
			args: [entry, ...args],
			cwd,
			env,
			stop,
			timeoutMs,
			forceMs: 1500,
			ownedProfileRoots: [ownedRoot],
		}),
		child = stop.current?.child;
	if (!child) {
		await pending;
		throw Error("ADDITIVE_PUBLIC_PROOF_INVALID: no actual child publication");
	}
	const running = {
		pid: child.pid,
		pgid: child.pid,
		entry,
		nodeExecutable: process.execPath,
		cwd,
		profiles: [ownedRoot],
		command:
			processRows().find((r) => r.pid === child.pid && r.pgid === child.pid)
				?.command ?? null,
		state: "running",
		spawnedUTC: new Date().toISOString(),
	};
	let observerError;
	const record = (e) => {
		events.push(e);
		if (e.phase === "close") {
			running.state = "close-event-observed";
			running.closeObserved = true;
		}
		try {
			onRecord({ running, events });
		} catch (error) {
			observerError = String(error);
			stop.request("observer");
		}
	};
	record({ phase: "spawn", pid: child.pid, time: performance.now() });
	child.prependOnceListener("exit", (code, signal) =>
		record({
			phase: "exit",
			pid: child.pid,
			code,
			signal,
			time: performance.now(),
		}),
	);
	child.once("close", (code, signal) =>
		record({
			phase: "close",
			pid: child.pid,
			code,
			signal,
			time: performance.now(),
		}),
	);
	const raw = await pending;
	running.closedProven =
		raw.closed === true &&
		!raw.pipeAbandonment &&
		!raw.spawnError &&
		raw.ownership.issues.length === 0 &&
		raw.ownership.remaining.length === 0;
	running.state = running.closedProven ? "closed" : "unproven";
	onRecord({ running, events });
	return { ...raw, events, running, observerError };
}

import { describe, expect, it } from "@rstest/core";
import type { VerifiedTelegramScope } from "../adapters/telegram/signed-launch";
import { TelegramRuntimeSession } from "./telegram-runtime-session";

const scopeA = `tma-v1-${"a".repeat(64)}` as VerifiedTelegramScope;
const scopeB = `tma-v1-${"b".repeat(64)}` as VerifiedTelegramScope;

function checkpoint() {
	let release: () => void = () => undefined;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

describe("Telegram runtime operation ownership", () => {
	it("drains an admitted composite transaction before disposal and rejects queued and late work", async () => {
		const session = new TelegramRuntimeSession(scopeA);
		const entered = checkpoint();
		const transaction = checkpoint();
		const events: string[] = [];
		const publishing = session.run(async () => {
			events.push("staging");
			entered.release();
			await transaction.promise;
			events.push("pointer-transaction-complete");
			return "durable";
		});
		await entered.promise;
		const queued = session.run(async () => {
			events.push("queued-write");
		});
		const queuedRejected = expect(queued).rejects.toThrow(
			"Telegram session is closed",
		);
		let disposed = false;
		const stopping = session.revoke().then(() => {
			disposed = true;
		});
		expect(session.signal.aborted).toBe(true);
		expect(disposed).toBe(false);
		await expect(
			session.run(async () => {
				events.push("late-write");
			}),
		).rejects.toThrow("Telegram session is closed");
		expect(disposed).toBe(false);
		transaction.release();
		expect(await publishing).toBe("durable");
		await queuedRejected;
		await stopping;
		expect(disposed).toBe(true);
		expect(events).toEqual(["staging", "pointer-transaction-complete"]);
	});

	it("serializes complete operations including awaits and preserves results", async () => {
		const session = new TelegramRuntimeSession(scopeA);
		const entered = checkpoint();
		const release = checkpoint();
		const events: string[] = [];
		const first = session.run(async () => {
			events.push("first-start");
			entered.release();
			await release.promise;
			events.push("first-end");
			return 1;
		});
		await entered.promise;
		const second = session.run(async () => {
			events.push("second");
			return 2;
		});
		expect(events).toEqual(["first-start"]);
		release.release();
		expect(await Promise.all([first, second])).toEqual([1, 2]);
		expect(events).toEqual(["first-start", "first-end", "second"]);
	});

	it("does not poison the queue after a failed operation", async () => {
		const session = new TelegramRuntimeSession(scopeA);
		await expect(
			session.run(async () => {
				throw new Error("transaction failed");
			}),
		).rejects.toThrow("transaction failed");
		expect(await session.run(async () => "next-transaction")).toBe(
			"next-transaction",
		);
		await session.revoke();
	});

	it("revokes before queued admission and aborts only once", async () => {
		const session = new TelegramRuntimeSession(scopeA);
		let calls = 0;
		let aborts = 0;
		session.signal.addEventListener("abort", () => {
			aborts += 1;
		});
		const pending = session.run(async () => {
			calls += 1;
		});
		const rejected = expect(pending).rejects.toThrow(
			"Telegram session is closed",
		);
		await Promise.all([session.revoke(), session.revoke()]);
		await rejected;
		expect(calls).toBe(0);
		expect(aborts).toBe(1);
	});

	it("never revives an old generation when the same scope returns after A to B to A", async () => {
		const oldA = new TelegramRuntimeSession(scopeA);
		const completedDownload = checkpoint();
		const roots = new Map<string, string>();
		const lateDownload = completedDownload.promise.then(() =>
			oldA.run(async () => {
				roots.set(oldA.scope, "late-resource");
			}),
		);
		await oldA.revoke();
		const b = new TelegramRuntimeSession(scopeB);
		await b.run(async () => {
			roots.set(b.scope, "b-resource");
		});
		await b.revoke();
		const newA = new TelegramRuntimeSession(scopeA);
		await newA.run(async () => {
			roots.set(newA.scope, "a-resource");
		});
		const rejected = expect(lateDownload).rejects.toThrow(
			"Telegram session is closed",
		);
		completedDownload.release();
		await rejected;
		expect(roots).toEqual(
			new Map([
				[scopeB, "b-resource"],
				[scopeA, "a-resource"],
			]),
		);
		expect(oldA.signal.aborted).toBe(true);
		expect(newA.signal.aborted).toBe(false);
		await newA.revoke();
	});
});

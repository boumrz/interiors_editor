import { describe, expect, it, rstest } from "@rstest/core";
import { withNativeCancellation } from "./native-cancellation";

function observer() {
	let check: () => void = () => undefined;
	let stops = 0;
	let watches = 0;
	return {
		watch(callback: () => void) {
			watches++;
			check = callback;
			return () => {
				stops++;
			};
		},
		check: () => check(),
		stops: () => stops,
		watches: () => watches,
	};
}

describe("native cancellation ownership", () => {
	it("delivers a live view through the real timer and releases that timer after the pending reader stops", async () => {
		const schedule = rstest.spyOn(globalThis, "setInterval");
		const stop = rstest.spyOn(globalThis, "clearInterval");
		const source = { aborted: false }; let observed = false;
		let change: ReturnType<typeof setTimeout> | undefined;
		let deadline: ReturnType<typeof setTimeout> | undefined;
		try {
			const result = await withNativeCancellation(source, async (signal) => {
				if (!signal) throw new Error("Expected a native cancellation source");
				return new Promise<string>((resolve) => {
					signal.addEventListener("abort", () => { observed = true; resolve("aborted"); }, { once: true });
					change = setTimeout(() => { source.aborted = true; }, 8);
					deadline = setTimeout(() => resolve("deadline"), 100);
				});
			});
			expect(result).toEqual({ kind: "cancelled" }); expect(observed).toBe(true);
			expect(schedule).toHaveBeenCalledTimes(1);
			expect(stop).toHaveBeenCalledWith(schedule.mock.results[0].value);
		} finally {
			clearTimeout(change); clearTimeout(deadline);
			for (const call of schedule.mock.results) if (call.type === "return") clearInterval(call.value);
			schedule.mockRestore(); stop.mockRestore();
		}
	});
	it("refuses a cancellation that arrives while its owned observer is being installed", async () => {
		const source = { aborted: false }; let operations = 0; let stops = 0;
		expect(await withNativeCancellation(source, async () => { operations++; }, { watch: () => { source.aborted = true; return () => { stops++; }; } })).toEqual({ kind: "cancelled" });
		expect(operations).toBe(0); expect(stops).toBe(1);
	});
	it("passes real native signals unchanged and does not start a polling observer", async () => {
		const controller = new AbortController();
		const polling = observer();
		expect(
			await withNativeCancellation(
				controller.signal,
				async (signal) => {
					expect(signal).toBe(controller.signal);
					return 42;
				},
				polling,
			),
		).toEqual({ kind: "completed", value: 42 });
		expect(
			await withNativeCancellation(
				undefined,
				async (signal) => {
					expect(signal).toBeUndefined();
					return 7;
				},
				polling,
			),
		).toEqual({ kind: "completed", value: 7 });
		expect(polling.watches()).toBe(0);
	});
	it("rejects initial cancellation before invoking the reader or allocating a polling observer", async () => {
		const polling = observer();
		let calls = 0;
		expect(
			await withNativeCancellation(
				{ aborted: true },
				async () => {
					calls++;
				},
				polling,
			),
		).toEqual({ kind: "cancelled" });
		expect(calls).toBe(0);
		expect(polling.watches()).toBe(0);
	});
	it("follows a plain live view during an internal pending read using a real owned AbortSignal", async () => {
		const source = { aborted: false };
		const polling = observer();
		let entered = false;
		let released = false;
		const pending = withNativeCancellation(
			source,
			async (signal) => {
				expect(signal).toBeInstanceOf(AbortSignal);
				if (!signal) throw new Error("Expected owned native signal");
				entered = true;
				await new Promise<void>((resolve) =>
					signal.addEventListener(
						"abort",
						() => {
							released = true;
							resolve();
						},
						{ once: true },
					),
				);
				return "stopped";
			},
			polling,
		);
		expect(entered).toBe(true);
		source.aborted = true;
		polling.check();
		expect(await pending).toEqual({ kind: "cancelled" });
		expect(released).toBe(true);
		expect(polling.stops()).toBe(1);
	});
	it("checks late cancellation even if the reader finishes before the next observer tick", async () => {
		const source = { aborted: false };
		const polling = observer();
		expect(
			await withNativeCancellation(
				source,
				async () => {
					source.aborted = true;
					return "late result";
				},
				polling,
			),
		).toEqual({ kind: "cancelled" });
		expect(polling.stops()).toBe(1);
	});
	it("cleans the observer on success and failure without relabeling an implementation error as corrupt input", async () => {
		const first = observer();
		expect(
			await withNativeCancellation(
				{ aborted: false },
				async () => "value",
				first,
			),
		).toEqual({ kind: "completed", value: "value" });
		expect(first.stops()).toBe(1);
		const second = observer();
		const failure = new Error("Verifier unavailable");
		await expect(
			withNativeCancellation(
				{ aborted: false },
				async () => {
					throw failure;
				},
				second,
			),
		).rejects.toBe(failure);
		expect(second.stops()).toBe(1);
		await expect(withNativeCancellation(undefined, async () => { throw failure; }, observer())).rejects.toBe(failure);
	});
	it("settles a cancelled read failure as cancellation and still cleans its observer", async () => {
		const source = { aborted: false };
		const polling = observer();
		expect(
			await withNativeCancellation(
				source,
				async () => {
					source.aborted = true;
					throw new DOMException("Cancelled", "AbortError");
				},
				polling,
			),
		).toEqual({ kind: "cancelled" });
		expect(polling.stops()).toBe(1);
	});
});

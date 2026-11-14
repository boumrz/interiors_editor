import { describe, expect, it } from "@rstest/core";
import { readBoundedLocalGlbFiles } from "./bounded-local-glb-files";

const mib = 1024 * 1024;
function input(size: number, data = new Uint8Array([103, 108, 84, 70])) {
	let reads = 0;
	return {
		file: {
			size,
			async arrayBuffer() {
				reads++;
				return data.slice().buffer;
			},
		},
		reads: () => reads,
	};
}
describe("bounded local GLB file reads", () => {
	it("executes the requested mutation namespace", async () => {
		await readBoundedLocalGlbFiles([], "new-model");
		const runtime: unknown = Reflect.get(globalThis, "process");
		const environment: unknown =
			runtime && typeof runtime === "object"
				? Reflect.get(runtime, "env")
				: undefined;
		const expected: unknown =
			environment && typeof environment === "object"
				? Reflect.get(environment, "__STRYKER_ACTIVE_MUTANT__")
				: undefined;
		if (expected !== undefined) {
			const namespace: unknown = Reflect.get(globalThis, "__stryker__");
			if (!namespace || typeof namespace !== "object")
				throw new Error("Mutation activation namespace missing");
			expect(Reflect.get(namespace, "activeMutant")).toBe(expected);
		}
	});
	it("rejects an oversized new model before reading its bytes", async () => {
		const source = input(25 * mib + 1);
		expect(await readBoundedLocalGlbFiles([source.file], "new-model")).toEqual({
			kind: "rejected",
		});
		expect(source.reads()).toBe(0);
	});
	it("permits exact historical repair above the new-model limit and rejects oversized sets before reading any member", async () => {
		for (const sizes of [
			[50 * mib + 1],
			[50 * mib, 50 * mib, 50 * mib, 30 * mib + 1],
			Array.from({ length: 901 }, () => 1),
		]) {
			const files = sizes.map((size) => input(size));
			expect(
				await readBoundedLocalGlbFiles(
					files.map((x) => x.file),
					"exact-repair",
				),
			).toEqual({ kind: "rejected" });
			expect(files.map((x) => x.reads())).toEqual(files.map(() => 0));
		}
	});
	it("allows the exact count/file/aggregate boundaries to reach byte verification", async () => {
		for (const sizes of [
			[25 * mib],
			[50 * mib],
			[50 * mib, 50 * mib, 50 * mib, 30 * mib],
			Array.from({ length: 900 }, () => 1),
		]) {
			const files = sizes.map((size) => input(size));
			await readBoundedLocalGlbFiles(
				files.map((x) => x.file),
				sizes[0] === 25 * mib ? "new-model" : "exact-repair",
			);
			expect(files[0]?.reads()).toBe(1);
		}
	});
	it("owns the read bytes, checks exact declared length and rejects invalid metadata without reads", async () => {
		const bytes = new Uint8Array([1, 2, 3]),
			source = input(3, bytes);
		const result = await readBoundedLocalGlbFiles([source.file], "new-model");
		expect(result).toEqual({
			kind: "read",
			bytes: [new Uint8Array([1, 2, 3])],
		});
		bytes[0] = 9;
		expect(result).toEqual({
			kind: "read",
			bytes: [new Uint8Array([1, 2, 3])],
		});
		const wrong = input(4, bytes);
		expect(await readBoundedLocalGlbFiles([wrong.file], "new-model")).toEqual({
			kind: "rejected",
		});
		for (const size of [-1, NaN, Infinity, 1.5]) {
			const invalid = input(size);
			expect(
				await readBoundedLocalGlbFiles([invalid.file], "exact-repair"),
			).toEqual({ kind: "rejected" });
			expect(invalid.reads()).toBe(0);
		}
	});
	it("keeps empty or multiple new model selections out of the parser", async () => {
		expect(await readBoundedLocalGlbFiles([], "new-model")).toEqual({
			kind: "rejected",
		});
		const a = input(1),
			b = input(1);
		expect(
			await readBoundedLocalGlbFiles([a.file, b.file], "new-model"),
		).toEqual({ kind: "rejected" });
		expect(a.reads() + b.reads()).toBe(0);
	});
	it("passes a zero-byte file to content validation, without confusing it with an empty selection", async () => {
		for (const purpose of ["new-model", "exact-repair"] as const) {
			const empty = input(0, new Uint8Array());
			expect(await readBoundedLocalGlbFiles([empty.file], purpose)).toEqual({
				kind: "read",
				bytes: [new Uint8Array()],
			});
			expect(empty.reads()).toBe(1);
		}
	});
	it("returns every exact repair member in selection order", async () => {
		const files = [
			input(2, new Uint8Array([17, 19])),
			input(3, new Uint8Array([23, 29, 31])),
			input(1, new Uint8Array([37])),
		];
		expect(
			await readBoundedLocalGlbFiles(
				files.map(({ file }) => file),
				"exact-repair",
			),
		).toEqual({
			kind: "read",
			bytes: [
				new Uint8Array([17, 19]),
				new Uint8Array([23, 29, 31]),
				new Uint8Array([37]),
			],
		});
		expect(files.map(({ reads }) => reads())).toEqual([1, 1, 1]);
	});
	it("validates a bad late member before reading any valid earlier member", async () => {
		const first = input(3, new Uint8Array([3, 5, 7])),
			last = input(NaN);
		expect(
			await readBoundedLocalGlbFiles([first.file, last.file], "exact-repair"),
		).toEqual({ kind: "rejected" });
		expect([first.reads(), last.reads()]).toEqual([0, 0]);
	});
	it("rejects a changed late member without reading later files or returning a partial set", async () => {
		const files = [
			input(2, new Uint8Array([3, 5])),
			input(4, new Uint8Array([7, 11, 13])),
			input(1, new Uint8Array([17])),
		];
		expect(
			await readBoundedLocalGlbFiles(
				files.map(({ file }) => file),
				"exact-repair",
			),
		).toEqual({ kind: "rejected" });
		expect(files.map(({ reads }) => reads())).toEqual([1, 1, 0]);
	});
	it("propagates a local read failure and leaves later selected files unread", async () => {
		const first = input(2, new Uint8Array([3, 5])),
			last = input(1, new Uint8Array([7]));
		const failure = new Error("Local file became unreadable");
		const broken = {
			size: 3,
			async arrayBuffer(): Promise<ArrayBuffer> {
				throw failure;
			},
		};
		await expect(
			readBoundedLocalGlbFiles([first.file, broken, last.file], "exact-repair"),
		).rejects.toBe(failure);
		expect([first.reads(), last.reads()]).toEqual([1, 0]);
	});
});

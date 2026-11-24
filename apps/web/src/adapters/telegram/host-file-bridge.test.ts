import { describe, expect, it, rstest } from "@rstest/core";
import {
	createBrowserHostFileBridge,
	createTelegramHostFileBridge,
	createHostFileBridge,
	type HostFileSystemPort,
	type PreparedHostFile,
} from "./host-file-bridge";

function prepared(
	bridge = createHostFileBridge({ maximumBytes: 8, system: {} }),
): PreparedHostFile {
	const result = bridge.prepare({
		bytes: Uint8Array.of(1, 2, 3),
		filename: "Мой план.interiors",
		fileKind: "portable-backup",
	});
	if (result.kind !== "prepared") throw new Error("Expected a local File");
	return result;
}

function pendingRead() {
	const callbacks = {
		resolve: (_value: ArrayBuffer): void => undefined,
		reject: (_error: unknown): void => undefined,
	};
	const promise = new Promise<ArrayBuffer>((resolve, reject) => {
		callbacks.resolve = resolve;
		callbacks.reject = reject;
	});
	return { ...callbacks, promise };
}

describe("local host file handoff", () => {
	it("uses the native save picker with the exact export, and otherwise shares files locally", async () => {
		const options: unknown[] = [];
		const written: File[] = [];
		const shared: File[] = [];
		let committed = 0;
		rstest.stubGlobal("showSaveFilePicker", async (value: unknown) => {
			options.push(value);
			return { createWritable: async () => ({
				write: async (file: File) => { written.push(file); },
				close: async () => { committed++; },
				abort: async () => { throw new Error("Successful writes must not abort"); },
			}) };
		});
		rstest.stubGlobal("navigator", {
			canShare: () => true,
			share: async ({ files }: ShareData) => { shared.push(...(files ?? [])); },
		});
		try {
			const bridge = createTelegramHostFileBridge({ maximumBytes: 8 });
			const file = prepared(bridge);
			const writing = bridge.handoff(file);
			expect(options).toEqual([{ suggestedName: file.file.name }]);
			expect(await writing).toEqual({ kind: "handoff-attempted", method: "save" });
			expect(written).toEqual([file.file]);
			expect(new Uint8Array(await written[0].arrayBuffer())).toEqual(new Uint8Array(await file.file.arrayBuffer()));
			expect(committed).toBe(1);
			expect(shared).toEqual([]);
			rstest.stubGlobal("showSaveFilePicker", undefined);
			expect(await bridge.handoff(file)).toEqual({ kind: "handoff-attempted", method: "share" });
			expect(shared).toEqual([file.file]);
		} finally {
			rstest.unstubAllGlobals();
		}
	});

	it("never relabels a Blob click as a Telegram system handoff", async () => {
		rstest.stubGlobal("navigator", {});
		rstest.stubGlobal("showSaveFilePicker", undefined);
		const create = rstest.spyOn(URL, "createObjectURL");
		try {
			const bridge = createTelegramHostFileBridge({ maximumBytes: 8 });
			expect(await bridge.handoff(prepared(bridge))).toEqual({ kind: "unsupported" });
			expect(create).not.toHaveBeenCalled();
		} finally {
			create.mockRestore();
			rstest.unstubAllGlobals();
		}
	});

	it("cancels an abandoned write, cleans up failed writes and can retry the same file", async () => {
		const abort = new AbortController();
		const written: File[] = [];
		let attempts = 0;
		let discards = 0;
		let committed = 0;
		rstest.stubGlobal("showSaveFilePicker", async () => ({
			createWritable: async () => ({
				write: async (file: File) => {
					written.push(file);
					if (++attempts === 1) throw new DOMException("Disk full", "QuotaExceededError");
					if (attempts === 2) abort.abort();
				},
				close: async () => { committed++; },
				abort: async () => { discards++; },
			}),
		}));
		try {
			const bridge = createTelegramHostFileBridge({ maximumBytes: 8 });
			const file = prepared(bridge);
			expect(await bridge.handoff(file)).toEqual({ kind: "failed", reasonCode: "FILE_HANDOFF_FAILED" });
			expect(await bridge.handoff(file, abort.signal)).toEqual({ kind: "cancelled" });
			expect(await bridge.handoff(file)).toEqual({ kind: "handoff-attempted", method: "save" });
			expect(written).toEqual([file.file, file.file, file.file]);
			expect(discards).toBe(2);
			expect(committed).toBe(1);
		} finally {
			rstest.unstubAllGlobals();
		}
	});

	it("reports an ambiguous save picker abort without starting another system action", async () => {
		const shared: File[] = [];
		rstest.stubGlobal("navigator", {
			canShare: () => true,
			share: async ({ files }: ShareData) => { shared.push(...(files ?? [])); },
		});
		rstest.stubGlobal("showSaveFilePicker", async () => {
			throw new DOMException("The user aborted a request", "AbortError");
		});
		try {
			const bridge = createTelegramHostFileBridge({ maximumBytes: 8 });
			expect(await bridge.handoff(prepared(bridge))).toEqual({ kind: "save-incomplete" });
			expect(shared).toEqual([]);
		} finally {
			rstest.unstubAllGlobals();
		}
	});

	it("stops at the first cancelled boundary before changing a selected local file", async () => {
		for (const boundary of ["picker", "stream"] as const) {
			const abort = new AbortController();
			const actions: string[] = [];
			rstest.stubGlobal("showSaveFilePicker", async () => {
				actions.push("picker");
				if (boundary === "picker") abort.abort();
				return { createWritable: async () => {
					actions.push("stream");
					abort.abort();
					return {
						write: async () => { actions.push("write"); },
						close: async () => { actions.push("close"); },
						abort: async () => { actions.push("abort"); },
					};
				} };
			});
			try {
				const bridge = createTelegramHostFileBridge({ maximumBytes: 8 });
				expect(await bridge.handoff(prepared(bridge), abort.signal)).toEqual({ kind: "cancelled" });
				expect(actions).toEqual(boundary === "picker" ? ["picker"] : ["picker", "stream", "abort"]);
			} finally {
				rstest.unstubAllGlobals();
			}
		}
	});
	it("prepares an exact native File without claiming an external backup", async () => {
		const bridge = createHostFileBridge({ maximumBytes: 3, system: {} });
		const bytes = Uint8Array.of(1, 2, 3);
		const result = bridge.prepare({
			bytes,
			filename: "Мой план.interiors",
			fileKind: "portable-backup",
		});
		bytes.fill(9);
		expect(result.kind).toBe("prepared");
		if (result.kind !== "prepared") throw new Error("Expected preparation");
		expect(result.file).toBeInstanceOf(File);
		expect(result.fileKind).toBe("portable-backup");
		expect(result.file.name).toBe("Мой план.interiors");
		expect(result.file.type).toBe("application/zip");
		expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(
			Uint8Array.of(1, 2, 3),
		);
		expect(Object.keys(result).sort()).toEqual(["file", "fileKind", "kind"]);
	});

	it("prepares only the supplied byte view without leaking its larger backing buffer", async () => {
		const bridge = createHostFileBridge({ maximumBytes: 3, system: {} });
		const backing = Uint8Array.of(90, 1, 2, 3, 91);
		const result = bridge.prepare({
			bytes: backing.subarray(1, 4),
			filename: "view.interiors",
			fileKind: "portable-backup",
		});
		if (result.kind !== "prepared") throw new Error("Expected exact byte view");
		expect(result.file.size).toBe(3);
		expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(
			Uint8Array.of(1, 2, 3),
		);
	});

	it("keeps recovery data visibly distinct and preserves an existing recovery filename", () => {
		const bridge = createHostFileBridge({ maximumBytes: 8, system: {} });
		for (const filename of ["Правка", "Правка.interiors-recovery.json"]) {
			const result = bridge.prepare({
				bytes: Uint8Array.of(1),
				filename,
				fileKind: "recovery-draft",
			});
			expect(result).toMatchObject({
				kind: "prepared",
				fileKind: "recovery-draft",
			});
			if (result.kind !== "prepared") throw new Error("Expected recovery File");
			expect(result.file.name).toBe("Правка.interiors-recovery.json");
			expect(result.file.type).toBe("application/json");
		}
	});

	it("rejects oversized preparation and invalid injected limits without creating a handoff", () => {
		const bridge = createHostFileBridge({ maximumBytes: 2, system: {} });
		expect(
			bridge.prepare({
				bytes: Uint8Array.of(1, 2, 3),
				filename: "plan.interiors",
				fileKind: "portable-backup",
			}),
		).toEqual({ kind: "rejected", reasonCode: "FILE_LIMIT_EXCEEDED" });
		for (const maximumBytes of [
			0,
			-1,
			1.5,
			Number.NaN,
			Number.POSITIVE_INFINITY,
		]) {
			expect(() =>
				createHostFileBridge({ maximumBytes, system: {} }),
			).toThrow();
		}
	});

	it("returns an honest preparation failure when native File is unavailable or cannot allocate", () => {
		const bridge = createHostFileBridge({ maximumBytes: 8, system: {} });
		for (const fileConstructor of [
			undefined,
			class {
				constructor() {
					throw new Error("Cannot allocate File");
				}
			},
		]) {
			rstest.stubGlobal("File", fileConstructor);
			try {
				expect(
					bridge.prepare({
						bytes: Uint8Array.of(1),
						filename: "plan.interiors",
						fileKind: "portable-backup",
					}),
				).toEqual({ kind: "failed", reasonCode: "FILE_PREPARATION_FAILED" });
			} finally {
				rstest.unstubAllGlobals();
			}
		}
	});

	it("reads an actual native File exactly at its injected size limit", async () => {
		const file = new File([Uint8Array.of(4, 5, 6)], "restore.interiors");
		const bridge = createHostFileBridge({ maximumBytes: 3, system: {} });
		expect(await bridge.read(file)).toEqual({
			kind: "read",
			filename: "restore.interiors",
			bytes: Uint8Array.of(4, 5, 6),
		});
	});

	it("checks input File.size before arrayBuffer and declines a late oversized buffer", async () => {
		const bridge = createHostFileBridge({ maximumBytes: 3, system: {} });
		const reads: string[] = [];
		const tooLarge = new File([Uint8Array.of(1, 2, 3, 4)], "large.interiors");
		Object.defineProperty(tooLarge, "arrayBuffer", {
			value: () => {
				reads.push("read");
				throw new Error("Must not allocate");
			},
		});
		expect(await bridge.read(tooLarge)).toEqual({
			kind: "rejected",
			reasonCode: "FILE_LIMIT_EXCEEDED",
		});
		expect(reads).toEqual([]);
		const changed = new File([Uint8Array.of(1)], "changed.interiors");
		Object.defineProperty(changed, "arrayBuffer", {
			value: async () => new ArrayBuffer(4),
		});
		expect(await bridge.read(changed)).toEqual({
			kind: "rejected",
			reasonCode: "FILE_LIMIT_EXCEEDED",
		});
	});

	it("does not admit a partial file or a failed read", async () => {
		const bridge = createHostFileBridge({ maximumBytes: 8, system: {} });
		const partial = new File([Uint8Array.of(1, 2)], "partial.interiors");
		Object.defineProperty(partial, "arrayBuffer", {
			value: async () => new ArrayBuffer(1),
		});
		expect(await bridge.read(partial)).toEqual({
			kind: "rejected",
			reasonCode: "FILE_SIZE_MISMATCH",
		});
		const failed = new File([], "failed.interiors");
		Object.defineProperty(failed, "arrayBuffer", {
			value: async () => {
				throw new Error("Read failure");
			},
		});
		expect(await bridge.read(failed)).toEqual({
			kind: "failed",
			reasonCode: "FILE_READ_FAILED",
		});
	});

	it("rejects work cancelled before preparation or read without reading the File", async () => {
		const abort = new AbortController();
		abort.abort();
		const bridge = createHostFileBridge({ maximumBytes: 8, system: {} });
		expect(
			bridge.prepare(
				{
					bytes: Uint8Array.of(1),
					filename: "plan.interiors",
					fileKind: "portable-backup",
				},
				abort.signal,
			),
		).toEqual({ kind: "cancelled" });
		const file = new File([], "cancelled.interiors");
		let reads = 0;
		Object.defineProperty(file, "arrayBuffer", {
			value: () => {
				reads += 1;
				throw new Error("Must not read");
			},
		});
		expect(await bridge.read(file, abort.signal)).toEqual({
			kind: "cancelled",
		});
		expect(reads).toBe(0);
	});

	it("discards both a late read result and a late read failure after cancellation", async () => {
		const bridge = createHostFileBridge({ maximumBytes: 8, system: {} });
		for (const outcome of ["resolve", "reject"] as const) {
			const deferred = pendingRead();
			const abort = new AbortController();
			const file = new File([Uint8Array.of(1)], "late.interiors");
			Object.defineProperty(file, "arrayBuffer", {
				value: () => deferred.promise,
			});
			const result = bridge.read(file, abort.signal);
			abort.abort();
			if (outcome === "resolve") deferred.resolve(new ArrayBuffer(1));
			else deferred.reject(new Error("Late read failure"));
			expect(await result).toEqual({ kind: "cancelled" });
		}
	});

	it("passes the exact local File to system share and only reports a handoff attempt", async () => {
		const checked: ShareData[] = [];
		const shared: ShareData[] = [];
		const downloaded: File[] = [];
		const system: HostFileSystemPort = {
			canShare: (data) => {
				checked.push(data);
				return true;
			},
			share: async (data) => {
				shared.push(data);
			},
			download: async (file) => {
				downloaded.push(file);
				return "attempted";
			},
		};
		const bridge = createHostFileBridge({ maximumBytes: 8, system });
		const file = prepared(bridge);
		expect(await bridge.handoff(file)).toEqual({
			kind: "handoff-attempted",
			method: "share",
		});
		expect(checked).toEqual([{ files: [file.file] }]);
		expect(shared).toEqual([{ files: [file.file] }]);
		expect(downloaded).toEqual([]);
	});

	it("uses local download only when file share is unavailable", async () => {
		for (const sharePort of [
			{},
			{
				canShare: () => false,
				share: async () => {
					throw new Error("Must not share");
				},
			},
			{ canShare: () => true },
			{
				share: async () => {
					throw new Error("Unprobed file sharing must not start");
				},
			},
		]) {
			const files: File[] = [];
			const bridge = createHostFileBridge({
				maximumBytes: 8,
				system: {
					...sharePort,
					download: async (file) => {
						files.push(file);
						return "attempted";
					},
				},
			});
			const file = prepared(bridge);
			expect(await bridge.handoff(file)).toEqual({
				kind: "handoff-attempted",
				method: "download",
			});
			expect(files).toEqual([file.file]);
		}
	});

	it("reports unsupported local handoff without pretending the file was saved", async () => {
		const bridge = createHostFileBridge({ maximumBytes: 8, system: {} });
		expect(await bridge.handoff(prepared(bridge))).toEqual({
			kind: "unsupported",
		});
		const unavailable = createHostFileBridge({
			maximumBytes: 8,
			system: { download: async () => "unsupported" },
		});
		expect(await unavailable.handoff(prepared(unavailable))).toEqual({
			kind: "unsupported",
		});
		const cancelled = createHostFileBridge({
			maximumBytes: 8,
			system: { download: async () => "cancelled" },
		});
		expect(await cancelled.handoff(prepared(cancelled))).toEqual({
			kind: "cancelled",
		});
	});

	it("rechecks the receiving bridge limit before any handoff", async () => {
		const actions: File[] = [];
		const bridge = createHostFileBridge({
			maximumBytes: 2,
			system: {
				download: async (file) => {
					actions.push(file);
					return "attempted";
				},
			},
		});
		expect(await bridge.handoff(prepared())).toEqual({
			kind: "rejected",
			reasonCode: "FILE_LIMIT_EXCEEDED",
		});
		expect(actions).toEqual([]);
	});

	it("hands off a File exactly at the receiving bridge's size limit", async () => {
		const files: File[] = [];
		const bridge = createHostFileBridge({
			maximumBytes: 3,
			system: {
				download: async (file) => {
					files.push(file);
					return "attempted";
				},
			},
		});
		const file = prepared(bridge);
		expect(await bridge.handoff(file)).toEqual({
			kind: "handoff-attempted",
			method: "download",
		});
		expect(files).toEqual([file.file]);
	});

	it("never starts a download after system share cancellation or failure", async () => {
		for (const error of [
			new DOMException("User cancelled", "AbortError"),
			new Error("Share failed"),
		]) {
			const downloads: File[] = [];
			const bridge = createHostFileBridge({
				maximumBytes: 8,
				system: {
					canShare: () => true,
					share: async () => {
						throw error;
					},
					download: async (file) => {
						downloads.push(file);
						return "attempted";
					},
				},
			});
			expect(await bridge.handoff(prepared(bridge))).toEqual(
				error.name === "AbortError"
					? { kind: "cancelled" }
					: { kind: "failed", reasonCode: "FILE_HANDOFF_FAILED" },
			);
			expect(downloads).toEqual([]);
		}
	});

	it("rejects pre-cancelled handoff and cancellation raised by the capability probe", async () => {
		const abort = new AbortController();
		const actions: string[] = [];
		let probes = 0;
		const bridge = createHostFileBridge({
			maximumBytes: 8,
			system: {
				canShare: () => {
					probes += 1;
					abort.abort();
					return false;
				},
				share: async () => {
					actions.push("share");
				},
				download: async () => {
					actions.push("download");
					return "attempted";
				},
			},
		});
		expect(await bridge.handoff(prepared(bridge), abort.signal)).toEqual({
			kind: "cancelled",
		});
		expect(await bridge.handoff(prepared(bridge), abort.signal)).toEqual({
			kind: "cancelled",
		});
		expect(actions).toEqual([]);
		expect(probes).toBe(1);
	});

	it("discards late successful or failed handoff callbacks after cancellation", async () => {
		for (const method of ["share", "download"] as const) {
			for (const outcome of ["resolve", "reject"] as const) {
				const deferred = pendingRead();
				const abort = new AbortController();
				const bridge = createHostFileBridge({
					maximumBytes: 8,
					system:
						method === "share"
							? {
									canShare: () => true,
									share: async () => {
										await deferred.promise;
									},
								}
							: {
									download: async () => {
										await deferred.promise;
										return "attempted";
									},
								},
				});
				const result = bridge.handoff(prepared(bridge), abort.signal);
				abort.abort();
				if (outcome === "resolve") deferred.resolve(new ArrayBuffer(0));
				else deferred.reject(new Error("Late handoff failure"));
				expect(await result).toEqual({ kind: "cancelled" });
			}
		}
	});

	it("classifies rejected non-Error values without rejecting the read or handoff contract", async () => {
		for (const error of [undefined, null, "failure", 42, false]) {
			const bridge = createHostFileBridge({
				maximumBytes: 8,
				system: {
					download: async () => {
						throw error;
					},
				},
			});
			const file = new File([], "failed.interiors");
			Object.defineProperty(file, "arrayBuffer", {
				value: async () => {
					throw error;
				},
			});
			expect(await bridge.read(file)).toEqual({
				kind: "failed",
				reasonCode: "FILE_READ_FAILED",
			});
			expect(await bridge.handoff(prepared(bridge))).toEqual({
				kind: "failed",
				reasonCode: "FILE_HANDOFF_FAILED",
			});
		}
	});

	it("classifies failed capability probes and local download failures honestly", async () => {
		for (const system of [
			{
				canShare: () => {
					throw new Error("Probe failed");
				},
				share: async () => undefined,
			},
			{
				download: async () => {
					throw new Error("Download failed");
				},
			},
		] satisfies HostFileSystemPort[]) {
			const bridge = createHostFileBridge({ maximumBytes: 8, system });
			expect(await bridge.handoff(prepared(bridge))).toEqual({
				kind: "failed",
				reasonCode: "FILE_HANDOFF_FAILED",
			});
		}
	});

	it("binds the real navigator methods lazily to their native receiver", async () => {
		const files: File[] = [];
		const navigator = {
			canShare(data: ShareData) {
				expect(this).toBe(navigator);
				return data.files?.length === 1;
			},
			async share(data: ShareData) {
				expect(this).toBe(navigator);
				files.push(...(data.files ?? []));
			},
		};
		rstest.stubGlobal("navigator", navigator);
		try {
			const bridge = createBrowserHostFileBridge({ maximumBytes: 8 });
			const file = prepared(bridge);
			expect(await bridge.handoff(file)).toEqual({
				kind: "handoff-attempted",
				method: "share",
			});
			expect(files).toEqual([file.file]);
		} finally {
			rstest.unstubAllGlobals();
		}
	});

	it("issues a local blob anchor handoff and revokes its URL without a saved claim", async () => {
		const urls: string[] = [];
		const clicked: Array<{ download: string; href: string }> = [];
		const anchor = {
			download: "",
			href: "",
			click() {
				clicked.push({ download: this.download, href: this.href });
			},
		};
		rstest.stubGlobal("navigator", {});
		rstest.stubGlobal("document", {
			createElement(tag: string) {
				expect(tag).toBe("a");
				return anchor;
			},
		});
		const create = rstest
			.spyOn(URL, "createObjectURL")
			.mockImplementation(() => "blob:local-file");
		const revoke = rstest
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation((url) => {
				urls.push(url);
			});
		try {
			const bridge = createBrowserHostFileBridge({ maximumBytes: 8 });
			const file = prepared(bridge);
			expect(await bridge.handoff(file)).toEqual({
				kind: "handoff-attempted",
				method: "download",
			});
			expect(create).toHaveBeenCalledWith(file.file);
			expect(clicked).toEqual([
				{ download: file.file.name, href: "blob:local-file" },
			]);
			expect(urls).toEqual([]);
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(urls).toEqual(["blob:local-file"]);
		} finally {
			create.mockRestore();
			revoke.mockRestore();
			rstest.unstubAllGlobals();
		}
	});

	it("falls back to local download when the browser canShare exists but share is absent", async () => {
		const clicks: string[] = [];
		rstest.stubGlobal("navigator", { canShare: () => true });
		rstest.stubGlobal("document", {
			createElement() {
				return {
					download: "",
					href: "",
					click() {
						clicks.push("download");
					},
				};
			},
		});
		const create = rstest
			.spyOn(URL, "createObjectURL")
			.mockImplementation(() => "blob:partial-browser");
		const revoke = rstest
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation(() => undefined);
		try {
			const bridge = createBrowserHostFileBridge({ maximumBytes: 8 });
			expect(await bridge.handoff(prepared(bridge))).toEqual({
				kind: "handoff-attempted",
				method: "download",
			});
			expect(clicks).toEqual(["download"]);
			await new Promise((resolve) => setTimeout(resolve, 0));
		} finally {
			create.mockRestore();
			revoke.mockRestore();
			rstest.unstubAllGlobals();
		}
	});

	it("cancels before the anchor click and immediately releases a URL created just before cancellation", async () => {
		const abort = new AbortController();
		let clicks = 0;
		rstest.stubGlobal("navigator", {});
		rstest.stubGlobal("document", {
			createElement() {
				abort.abort();
				return {
					download: "",
					href: "",
					click() {
						clicks += 1;
					},
				};
			},
		});
		const create = rstest
			.spyOn(URL, "createObjectURL")
			.mockImplementation(() => "blob:cancelled-before-click");
		const revoke = rstest
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation(() => undefined);
		try {
			const bridge = createBrowserHostFileBridge({ maximumBytes: 8 });
			const result = bridge.handoff(prepared(bridge), abort.signal);
			expect(clicks).toBe(0);
			expect(revoke).toHaveBeenCalledWith("blob:cancelled-before-click");
			expect(await result).toEqual({ kind: "cancelled" });
		} finally {
			create.mockRestore();
			revoke.mockRestore();
			rstest.unstubAllGlobals();
		}
	});

	it("cleans a local URL if anchor creation fails and reports missing browser capabilities", async () => {
		rstest.stubGlobal("navigator", {});
		rstest.stubGlobal("document", {
			createElement() {
				throw new Error("No DOM element");
			},
		});
		const create = rstest
			.spyOn(URL, "createObjectURL")
			.mockImplementation(() => "blob:failed-local-file");
		const revoke = rstest
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation(() => undefined);
		try {
			const bridge = createBrowserHostFileBridge({ maximumBytes: 8 });
			expect(await bridge.handoff(prepared(bridge))).toEqual({
				kind: "failed",
				reasonCode: "FILE_HANDOFF_FAILED",
			});
			expect(revoke).toHaveBeenCalledWith("blob:failed-local-file");
			rstest.stubGlobal("document", undefined);
			expect(await bridge.handoff(prepared(bridge))).toEqual({
				kind: "unsupported",
			});
		} finally {
			create.mockRestore();
			revoke.mockRestore();
			rstest.unstubAllGlobals();
		}
	});

	it("declines browser handoff when navigator or local Blob URL capabilities are missing", async () => {
		const file = prepared();
		rstest.stubGlobal("navigator", undefined);
		rstest.stubGlobal("document", undefined);
		try {
			const bridge = createBrowserHostFileBridge({ maximumBytes: 8 });
			expect(await bridge.handoff(file)).toEqual({ kind: "unsupported" });
			rstest.stubGlobal("document", {
				createElement() {
					throw new Error("Must not create an anchor");
				},
			});
			for (const urls of [
				undefined,
				{},
				{ revokeObjectURL: () => undefined },
				{
					createObjectURL: () => {
						throw new Error("Missing revoke must prevent creation");
					},
				},
			]) {
				rstest.stubGlobal("URL", urls);
				expect(await bridge.handoff(file)).toEqual({ kind: "unsupported" });
			}
		} finally {
			rstest.unstubAllGlobals();
		}
	});
});


it("keeps an unverified stored source a distinct exact JSON file instead of presenting it as a backup",async()=>{
 const bridge=createHostFileBridge({maximumBytes:1000,system:{}}),text=JSON.stringify({purpose:"interiors-editor-unverified-source",serializedProject:"  \ud800\u0000  "}),bytes=new TextEncoder().encode(text);
 const result=bridge.prepare({bytes,filename:"stored-source",fileKind:"unverified-source"});
 expect(result.kind).toBe("prepared");if(result.kind!=="prepared")throw new Error("No prepared source File");
 expect(result.fileKind).toBe("unverified-source");expect(result.file.type).toBe("application/json");expect(result.file.name).toBe("stored-source.interiors-source.json");
 bytes.fill(0);expect(await result.file.text()).toBe(text);
});

export type HostFileKind = "portable-backup" | "recovery-draft" | "unverified-source";

export type PreparedHostFile = {
	readonly kind: "prepared";
	readonly fileKind: HostFileKind;
	readonly file: File;
};

type Cancelled = { readonly kind: "cancelled" };
type LimitExceeded = {
	readonly kind: "rejected";
	readonly reasonCode: "FILE_LIMIT_EXCEEDED";
};

export interface HostFileSystemPort {
	canShare?(data: ShareData): boolean;
	share?(data: ShareData): Promise<void>;
	save?(file: File, signal?: AbortSignal): Promise<"written" | "cancelled"> | undefined;
	download?(
		file: File,
		signal?: AbortSignal,
	): Promise<"attempted" | "unsupported" | "cancelled">;
}

export type HostFileHandoffResult =
	| {
			readonly kind: "handoff-attempted";
			readonly method: "share" | "download" | "save";
	  }
	| { readonly kind: "unsupported" }
	| { readonly kind: "save-incomplete" }
	| { readonly kind: "failed"; readonly reasonCode: "FILE_HANDOFF_FAILED" }
	| Cancelled
	| LimitExceeded;

export type HostFileReadResult =
	| {
			readonly kind: "read";
			readonly bytes: Uint8Array;
			readonly filename: string;
	  }
	| { readonly kind: "failed"; readonly reasonCode: "FILE_READ_FAILED" }
	| { readonly kind: "rejected"; readonly reasonCode: "FILE_SIZE_MISMATCH" }
	| Cancelled
	| LimitExceeded;

/** Local transport only. Codec validity and an external file roundtrip are separate evidence. */
export function createHostFileBridge(dependencies: {
	readonly maximumBytes: number;
	readonly system: HostFileSystemPort;
}) {
	const { maximumBytes, system } = dependencies;
	if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
		throw new Error("A current file-size policy is required");
	}
	return {
		prepare(
			input: {
				readonly bytes: Uint8Array;
				readonly filename: string;
				readonly fileKind: HostFileKind;
			},
			signal?: AbortSignal,
		):
			| PreparedHostFile
			| Cancelled
			| LimitExceeded
			| {
					readonly kind: "failed";
					readonly reasonCode: "FILE_PREPARATION_FAILED";
			  } {
			if (signal?.aborted) return { kind: "cancelled" };
			if (input.bytes.byteLength > maximumBytes) return limitExceeded();
			const suffix = input.fileKind === "recovery-draft" ? ".interiors-recovery.json" : input.fileKind === "unverified-source" ? ".interiors-source.json" : undefined;
			const filename = suffix && !input.filename.endsWith(suffix) ? `${input.filename}${suffix}` : input.filename;
			try {
				return {
					kind: "prepared",
					fileKind: input.fileKind,
					file: new File([input.bytes.slice().buffer], filename, {
						type: input.fileKind === "portable-backup" ? "application/zip" : "application/json",
					}),
				};
			} catch {
				return { kind: "failed", reasonCode: "FILE_PREPARATION_FAILED" };
			}
		},
		async read(file: File, signal?: AbortSignal): Promise<HostFileReadResult> {
			if (signal?.aborted) return { kind: "cancelled" };
			if (file.size > maximumBytes) return limitExceeded();
			try {
				const buffer = await file.arrayBuffer();
				if (signal?.aborted) return { kind: "cancelled" };
				if (buffer.byteLength > maximumBytes) return limitExceeded();
				if (buffer.byteLength !== file.size) {
					return { kind: "rejected", reasonCode: "FILE_SIZE_MISMATCH" };
				}
				return {
					kind: "read",
					bytes: new Uint8Array(buffer),
					filename: file.name,
				};
			} catch (error) {
				return wasCancelled(error, signal)
					? { kind: "cancelled" }
					: { kind: "failed", reasonCode: "FILE_READ_FAILED" };
			}
		},
		async handoff(
			prepared: PreparedHostFile,
			signal?: AbortSignal,
		): Promise<HostFileHandoffResult> {
			if (signal?.aborted) return { kind: "cancelled" };
			if (prepared.file.size > maximumBytes) return limitExceeded();
			try {
				const saving = system.save?.(prepared.file, signal);
				if (saving) {
					const result = await saving.catch((error: unknown) => {
						// Android WebView also rejects with AbortError when the host cannot open the picker.
						if (wasCancelled(error, undefined)) return "save-incomplete";
						throw error;
					});
					if (signal?.aborted || result === "cancelled") return { kind: "cancelled" };
					return result === "save-incomplete"
						? { kind: "save-incomplete" }
						: { kind: "handoff-attempted", method: "save" };
				}
				if (signal?.aborted) return { kind: "cancelled" };
				const data: ShareData = { files: [prepared.file] };
				const canShare =
					system.canShare && system.share && system.canShare(data);
				if (signal?.aborted) return { kind: "cancelled" };
				if (canShare && system.share) {
					await system.share(data);
					return signal?.aborted
						? { kind: "cancelled" }
						: { kind: "handoff-attempted", method: "share" };
				}
				if (!system.download) return { kind: "unsupported" };
				const result = await system.download(prepared.file, signal);
				if (signal?.aborted || result === "cancelled")
					return { kind: "cancelled" };
				return result === "unsupported"
					? { kind: "unsupported" }
					: { kind: "handoff-attempted", method: "download" };
			} catch (error) {
				return wasCancelled(error, signal)
					? { kind: "cancelled" }
					: { kind: "failed", reasonCode: "FILE_HANDOFF_FAILED" };
			}
		},
	};
}

const localSharing = {
	canShare(data: ShareData) {
		const navigator = globalThis.navigator;
		return (
			typeof navigator?.canShare === "function" &&
			typeof navigator.share === "function" &&
			navigator.canShare(data)
		);
	},
	share(data: ShareData) {
		return globalThis.navigator.share(data);
	},
};

interface LocalSavePicker {
	showSaveFilePicker?(options: { readonly suggestedName: string }): Promise<{
		createWritable(): Promise<{
			write(file: File): Promise<void>;
			close(): Promise<void>;
			abort(): Promise<void>;
		}>;
	}>;
}

/** Telegram's WebView may support a system save picker or local share but ignore a Blob download link. */
export function createTelegramHostFileBridge(dependencies: {
	readonly maximumBytes: number;
}) {
	return createHostFileBridge({
		...dependencies,
		system: {
			...localSharing,
			save(file, signal) {
				const host: LocalSavePicker = globalThis as LocalSavePicker;
				if (typeof host.showSaveFilePicker !== "function") return undefined;
				const picker = host.showSaveFilePicker({ suggestedName: file.name });
				return writePickedFile(picker, file, signal);
			},
		},
	});
}

async function writePickedFile(
	picker: ReturnType<NonNullable<LocalSavePicker["showSaveFilePicker"]>>,
	file: File,
	signal?: AbortSignal,
): Promise<"written" | "cancelled"> {
	const handle = await picker;
	if (signal?.aborted) return "cancelled";
	const writable = await handle.createWritable();
	let written = false;
	try {
		if (signal?.aborted) return "cancelled";
		await writable.write(file);
		if (signal?.aborted) return "cancelled";
		await writable.close();
		written = true;
		return "written";
	} finally {
		if (!written) {
			await writable.abort().catch(() => undefined);
		}
	}
}

/** Resolves browser capabilities only on user action; importing/constructing opens no UI. */
export function createBrowserHostFileBridge(dependencies: {
	readonly maximumBytes: number;
}) {
	return createHostFileBridge({
		...dependencies,
		system: {
			...localSharing,
			async download(file, signal) {
				const document = globalThis.document;
				const urls = globalThis.URL;
				if (
					!document ||
					typeof urls?.createObjectURL !== "function" ||
					typeof urls.revokeObjectURL !== "function"
				)
					return "unsupported";
				if (signal?.aborted) return "cancelled";
				const url = urls.createObjectURL(file);
				let attempted = false;
				try {
					const anchor = document.createElement("a");
					anchor.download = file.name;
					anchor.href = url;
					if (signal?.aborted) return "cancelled";
					anchor.click();
					attempted = true;
					return "attempted";
				} finally {
					// Let the browser consume the click before releasing its local Blob URL.
					if (attempted) setTimeout(() => urls.revokeObjectURL(url), 0);
					else urls.revokeObjectURL(url);
				}
			},
		},
	});
}

function wasCancelled(
	error: unknown,
	signal: AbortSignal | undefined,
): boolean {
	return (
		signal?.aborted === true ||
		(typeof error === "object" &&
			error !== null &&
			"name" in error &&
			error.name === "AbortError")
	);
}

function limitExceeded(): LimitExceeded {
	return { kind: "rejected", reasonCode: "FILE_LIMIT_EXCEEDED" };
}

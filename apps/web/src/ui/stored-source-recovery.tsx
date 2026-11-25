import { copy } from "./editor-language";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
	ProjectSourceRecoveryPort,
	UnverifiedProjectSource,
} from "../application/ports";
import styles from "./stored-source-recovery.module.css";

const maximumSourceFileBytes = 200 * 1024 * 1024;
const sourcePurpose = "interiors-editor-unverified-source";

type PreparedUnverifiedSourceFile =
	| { readonly kind: "too-large" }
	| {
			readonly kind: "prepared-source";
			readonly filename: "project.interiors-source.json";
			readonly mimeType: "application/json";
			readonly bytes: Uint8Array;
	  };

/** Exact UTF8 length of JSON's string representation, without allocating it. */
function jsonStringBytes(value: string, remaining: number): number | undefined {
	let bytes = 2;
	for (let index = 0; index < value.length; index++) {
		const unit = value.charCodeAt(index);
		if (
			unit === 0x22 ||
			unit === 0x5c ||
			unit === 8 ||
			unit === 9 ||
			unit === 10 ||
			unit === 12 ||
			unit === 13
		)
			bytes += 2;
		else if (unit < 0x20) bytes += 6;
		else if (unit < 0x80) bytes++;
		else if (unit < 0x800) bytes += 2;
		else if (
			unit >= 0xd800 &&
			unit <= 0xdbff &&
			index + 1 < value.length &&
			value.charCodeAt(index + 1) >= 0xdc00 &&
			value.charCodeAt(index + 1) <= 0xdfff
		) {
			bytes += 4;
			index++;
		} else if (unit >= 0xd800 && unit <= 0xdfff) bytes += 6;
		else bytes += 3;
		if (bytes > remaining) return undefined;
	}
	return bytes <= remaining ? bytes : undefined;
}

/** A local, lossless source wrapper. It is neither a Portable Backup nor a Recovery Draft. */
export function prepareUnverifiedSourceFile(
	source: UnverifiedProjectSource,
	maximumBytes = maximumSourceFileBytes,
): PreparedUnverifiedSourceFile {
	if (
		!Number.isSafeInteger(maximumBytes) ||
		maximumBytes <= 0 ||
		maximumBytes > maximumSourceFileBytes
	)
		throw new RangeError("Invalid source file bound");
	const { projectId, revisionId, serializedProject } = source;
	const envelope = {
		purpose: sourcePurpose,
		version: 1,
		kind: "unverified-source",
		projectId: "",
		revisionId: "",
		serializedProject: "",
	};
	let bytes = JSON.stringify(envelope).length - 6;
	for (const value of [projectId, revisionId, serializedProject]) {
		const length = jsonStringBytes(value, maximumBytes - bytes);
		if (length === undefined) return { kind: "too-large" };
		bytes += length;
	}
	return {
		kind: "prepared-source",
		filename: "project.interiors-source.json",
		mimeType: "application/json",
		bytes: new TextEncoder().encode(
			JSON.stringify({ ...envelope, projectId, revisionId, serializedProject }),
		),
	};
}

type SourceAddress = Omit<UnverifiedProjectSource, "serializedProject">;
type Phase =
	| "idle"
	| "listing"
	| "listed"
	| "empty"
	| "list-error"
	| "reading"
	| "stale"
	| "read-error"
	| "preparing"
	| "prepared"
	| "export-error";
const statusCopy: Record<Phase, () => string> = {
	idle: () =>
		copy(
			"Покажите записи, чтобы выбрать исходные данные для отдельного файла.",
			"Show available records to export source data as a separate file.",
		),
	listing: () => copy("Поиск исходников…", "Finding source records…"),
	listed: () =>
		copy(
			"Выберите запись для подготовки исходника.",
			"Choose a source record to prepare for export.",
		),
	empty: () =>
		copy("Доступных исходников нет.", "No source records are available."),
	"list-error": () =>
		copy(
			"Не удалось получить список исходников. Повторите попытку.",
			"Could not list source records. Try again.",
		),
	reading: () =>
		copy("Чтение выбранного исходника…", "Reading the selected source record…"),
	stale: () =>
		copy(
			"Запись изменилась или недоступна. Обновите список и выберите её снова.",
			"The record changed or is no longer available. Refresh the list and select it again.",
		),
	"read-error": () =>
		copy(
			"Не удалось прочитать исходник. Обновите список или повторите попытку.",
			"Could not read the source record. Refresh the list or try again.",
		),
	preparing: () => copy("Подготовка исходника…", "Preparing source record…"),
	prepared: () =>
		copy(
			"Исходник подготовлен к передаче. Сохранение файла проверяется отдельно.",
			"The source record is ready to share. Check separately that the file was saved.",
		),
	"export-error": () =>
		copy(
			"Не удалось подготовить исходник. Повторите попытку.",
			"Could not prepare the source record. Try again.",
		),
};

export interface StoredSourceRecoveryProps {
	readonly port: ProjectSourceRecoveryPort;
	/** Fulfillment means local preparation only, never a saved file or a verified backup. */
	readonly onExport: (source: UnverifiedProjectSource) => Promise<void>;
}

export function StoredSourceRecovery({
	port,
	onExport,
}: StoredSourceRecoveryProps) {
	// A→B→A gets a new identity even if a caller reuses the first port object.
	const owner = useMemo(() => ({ port }), [port]);
	const currentOwner = useRef(owner);
	currentOwner.current = owner;
	const exporter = useRef(onExport);
	exporter.current = onExport;
	const alive = useRef(true);
	const operation = useRef<{ readonly owner: typeof owner } | undefined>(
		undefined,
	);
	const [view, setView] = useState<{
		readonly owner: typeof owner;
		readonly phase: Phase;
		readonly sources: readonly SourceAddress[];
	}>({ owner, phase: "idle", sources: [] });
	useLayoutEffect(() => {
		alive.current = true;
		currentOwner.current = owner;
		return () => {
			alive.current = false;
			operation.current = undefined;
		};
	}, [owner]);
	const current =
		view.owner === owner
			? view
			: { owner, phase: "idle" as const, sources: [] };
	const busy =
		current.phase === "listing" ||
		current.phase === "reading" ||
		current.phase === "preparing";
	function begin() {
		if (!alive.current || operation.current?.owner === owner) return undefined;
		const token = { owner };
		operation.current = token;
		return token;
	}
	function isCurrent(token: object) {
		return (
			alive.current &&
			currentOwner.current === owner &&
			operation.current === token
		);
	}
	async function list() {
		const token = begin();
		if (!token) return;
		setView({ owner, phase: "listing", sources: [] });
		try {
			const sources = await port.listRecoverySources();
			if (!isCurrent(token)) return;
			setView({
				owner,
				phase: sources.length ? "listed" : "empty",
				sources: sources.map(({ kind, projectId, revisionId }) => ({
					kind,
					projectId,
					revisionId,
				})),
			});
		} catch {
			if (isCurrent(token))
				setView({ owner, phase: "list-error", sources: [] });
		} finally {
			if (isCurrent(token)) operation.current = undefined;
		}
	}
	async function prepare(address: SourceAddress) {
		const token = begin();
		if (!token) return;
		const sources = current.sources;
		setView({ owner, phase: "reading", sources });
		let phase: Phase = "reading";
		try {
			const source = await port.readRecoverySource(
				address.projectId,
				address.revisionId,
			);
			if (!isCurrent(token)) return;
			if (
				source?.kind !== "unverified-source" ||
				source.projectId !== address.projectId ||
				source.revisionId !== address.revisionId
			) {
				setView({ owner, phase: "stale", sources });
				return;
			}
			phase = "preparing";
			setView({ owner, phase, sources });
			await exporter.current({
				kind: "unverified-source",
				projectId: source.projectId,
				revisionId: source.revisionId,
				serializedProject: source.serializedProject,
			});
			if (isCurrent(token)) setView({ owner, phase: "prepared", sources });
		} catch {
			if (isCurrent(token))
				setView({
					owner,
					phase: phase === "preparing" ? "export-error" : "read-error",
					sources,
				});
		} finally {
			if (isCurrent(token)) operation.current = undefined;
		}
	}
	return (
		<aside
			className={styles.panel}
			aria-label={copy("Непроверенные исходники", "Unverified source records")}
			aria-busy={busy}
		>
			<h2>{copy("Непроверенные исходники", "Unverified source records")}</h2>
			<p>
				{copy(
					"Исходные данные записи можно выгрузить отдельно. Это не полный backup и не восстановленный проект.",
					"You can export the source record separately. It is a raw record without a complete project backup.",
				)}
			</p>
			<button type="button" disabled={busy} onClick={() => void list()}>
				{current.phase === "idle"
					? copy("Показать записи", "Show records")
					: copy("Обновить список", "Refresh list")}
			</button>
			<p role="status">{statusCopy[current.phase]()}</p>
			{current.sources.length ? (
				<ul className={styles.list}>
					{current.sources.map((source, index) => (
						<li key={source.projectId}>
							<span>
								{copy("Запись ", "Record ")}
								{index + 1}
							</span>
							<button
								type="button"
								disabled={busy}
								aria-label={copy(
									`Подготовить исходник записи ${index + 1}`,
									`Prepare source record ${index + 1}`,
								)}
								onClick={() => void prepare(source)}
							>
								{copy("Подготовить исходник", "Prepare source record")}
							</button>
						</li>
					))}
				</ul>
			) : null}
		</aside>
	);
}

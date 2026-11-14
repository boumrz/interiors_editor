import type {
	ProjectStorageNamespace,
	ProjectStorageSourceStatus,
	ProjectSummary,
} from "../application/ports";

export function projectStorageLabel(
	namespace: ProjectStorageNamespace,
): string {
	return namespace === "legacy"
		? "На этом устройстве · обычное хранилище"
		: "На этом устройстве · хранилище для переноса";
}

export function projectDirectoryCards(
	projects: readonly ProjectSummary[],
	scoped: boolean,
) {
	const counts = new Map<string, number>(),
		occurrences = new Map<string, number>();
	for (const project of projects)
		counts.set(project.name, (counts.get(project.name) ?? 0) + 1);
	return projects.map((summary) => {
		const namespace = summary.storageNamespace;
		const confirmed =
			namespace === "legacy" || namespace === "browser-registered";
		const storageLabel = confirmed
			? projectStorageLabel(namespace)
			: scoped
				? "Источник проекта не подтверждён"
				: undefined;
		const occurrence = (occurrences.get(summary.name) ?? 0) + 1;
		occurrences.set(summary.name, occurrence);
		const copyLabel =
			scoped && (counts.get(summary.name) ?? 0) > 1
				? `Копия ${occurrence}`
				: undefined;
		return {
			summary,
			key: JSON.stringify([namespace ?? null, summary.projectId]),
			ownerConfirmed: !scoped || confirmed,
			storageLabel,
			copyLabel,
			spokenName: [
				summary.name,
				namespace === "legacy" && copyLabel === undefined
					? undefined
					: storageLabel,
				copyLabel,
			]
				.filter(Boolean)
				.join(" · "),
		};
	});
}

export function canShowProjectDirectoryEmpty(
	sources?: readonly ProjectStorageSourceStatus[],
): boolean {
	return (
		sources === undefined ||
		(sources.every((source) => source.kind === "available") &&
			sources.some((source) => source.storageNamespace === "legacy") &&
			sources.some(
				(source) => source.storageNamespace === "browser-registered",
			))
	);
}

export function ProjectStorageStatus({
	sources,
	onRetry,
}: {
	readonly sources: readonly ProjectStorageSourceStatus[];
	readonly onRetry: () => void;
}) {
	const unavailable = sources.filter(
		(source) =>
			source.kind === "unavailable" || source.kind === "recovery-required",
	);
	return (
		<section aria-label="Локальные хранилища">
			{unavailable.length > 0 ? (
				<div role="status">
					<p>Часть проектов сейчас недоступна</p>
					<ul>
						{unavailable.map((source) => (
							<li key={source.storageNamespace}>
								{projectStorageLabel(source.storageNamespace)} —{" "}
								{source.kind === "recovery-required"
									? "требуется проверка и восстановление"
									: "не удалось проверить"}
							</li>
						))}
					</ul>
					<button
						type="button"
						aria-label="Повторить проверку локальных хранилищ"
						onClick={onRetry}
					>
						Повторить
					</button>
				</div>
			) : null}
			{sources.some((source) => source.kind === "not-provisioned") ? (
				<p role="status">
					Хранилище для переноса сейчас не создано. История прежних данных
					неизвестна. Явный импорт создаст текущую область после проверки файла.
				</p>
			) : null}
			<details>
				<summary>Старая версия не видит перенесённые проекты</summary>
				<p>
					Проекты из хранилища для переноса не отображаются в старой версии.
					Резервная копия и её ручной импорт создают отдельную копию; проекты и
					история действий не синхронизируются. Совместимость файла со старой
					версией проверяйте отдельно.
				</p>
			</details>
		</section>
	);
}

export function projectDirectoryEmptyLabel(
	sources?: readonly ProjectStorageSourceStatus[],
 recoveryNeeded = false,
): string | undefined {
	if (recoveryNeeded) return undefined;
	if (canShowProjectDirectoryEmpty(sources)) return "Пока нет проектов";
	return sources?.some(
		(source) =>
			source.storageNamespace === "legacy" && source.kind === "available",
	)
		? "В обычном хранилище пока нет проектов"
		: undefined;
}

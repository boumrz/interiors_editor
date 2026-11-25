import { copy } from "./editor-language";
import type {
	ProjectStorageNamespace,
	ProjectStorageSourceStatus,
	ProjectSummary,
} from "../application/ports";

export function projectStorageLabel(
	namespace: ProjectStorageNamespace,
): string {
	return namespace === "legacy"
		? copy(
				"На этом устройстве · обычное хранилище",
				"On this device · standard storage",
			)
		: copy(
				"На этом устройстве · хранилище для переноса",
				"On this device · transfer storage",
			);
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
				? copy("Источник проекта не подтверждён", "Project source unverified")
				: undefined;
		const occurrence = (occurrences.get(summary.name) ?? 0) + 1;
		occurrences.set(summary.name, occurrence);
		const copyLabel =
			scoped && (counts.get(summary.name) ?? 0) > 1
				? copy(`Копия ${occurrence}`, `Copy ${occurrence}`)
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
		<section aria-label={copy("Локальные хранилища", "Local storage")}>
			{unavailable.length > 0 ? (
				<div role="status">
					<p>
						{copy(
							"Часть проектов сейчас недоступна",
							"Some projects are currently unavailable",
						)}
					</p>
					<ul>
						{unavailable.map((source) => (
							<li key={source.storageNamespace}>
								{projectStorageLabel(source.storageNamespace)} —{" "}
								{source.kind === "recovery-required"
									? copy(
											"требуется проверка и восстановление",
											"requires verification and recovery",
										)
									: copy("не удалось проверить", "could not verify")}
							</li>
						))}
					</ul>
					<button
						type="button"
						aria-label={copy(
							"Повторить проверку локальных хранилищ",
							"Check local storage again",
						)}
						onClick={onRetry}
					>
						{copy("Повторить", "Retry")}
					</button>
				</div>
			) : null}
			{sources.some((source) => source.kind === "not-provisioned") ? (
				<p role="status">
					{copy(
						"Хранилище для переноса сейчас не создано. История прежних данных неизвестна. Явный импорт создаст текущую область после проверки файла.",
						"Transfer storage has not been created on this device. The status of earlier data is unknown. Importing a file will create storage after verification.",
					)}
				</p>
			) : null}
			<details>
				<summary>
					{copy(
						"Старая версия не видит перенесённые проекты",
						"Transferred projects are unavailable in the old version",
					)}
				</summary>
				<p>
					{copy(
						"Проекты из хранилища для переноса не отображаются в старой версии. Резервная копия и её ручной импорт создают отдельную копию; проекты и история действий не синхронизируются. Совместимость файла со старой версией проверяйте отдельно.",
						"The old version cannot see projects in transfer storage. Exporting and manually importing a backup creates a separate copy. Projects and edit history do not sync. Check file compatibility with the old version separately.",
					)}
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
	if (canShowProjectDirectoryEmpty(sources))
		return copy("Пока нет проектов", "No projects yet");
	return sources?.some(
		(source) =>
			source.storageNamespace === "legacy" && source.kind === "available",
	)
		? copy(
				"В обычном хранилище пока нет проектов",
				"No projects in standard storage yet",
			)
		: undefined;
}

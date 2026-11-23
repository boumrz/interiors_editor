import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";

import type {
	ProjectController,
	ProjectScreenState,
} from "../app/project-controller";
import { createInitialProject } from "../domain/initial-project";
import type { Project } from "../domain/project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import {
	AppShell,
	catalogResultCountCopy,
	dimensionsAfterCustomGlbPreviewMeasurement,
	errorCopy,
	fbxConversionFeedback,
	hasProjectRevisionChanged,
	historyDiscardFailureCopy,
	itemPlacementFeedback,
	itemPlacementPreviewFeedback,
	itemPlacementWarningSummary,
	persistenceFailureCopy,
	preloadedGlbLoadingStatusCopy,
	projectDirectoryUpdatedCopy,
	projectNameErrorCopy,
	projectTransferImportFeedback,
	persistenceFailureActionCopy,
	renamePersistenceFailureCopy,
	shouldConsumeConfirmedWallDraft,
	shouldShowHealthyOfflineStatus,
	wallMutationCorrection,
	wallThicknessErrorCopy,
} from "./AppShell";
import { itemCountCopy } from "./item-count-copy";

describe("healthy local offline status", () => {
	it("appears only for an online-state-independent, writable Project surface", () => {
		expect(
			shouldShowHealthyOfflineStatus({
				isBrowserOnline: false,
				isReadOnly: false,
				stateKind: "saved",
			}),
		).toBe(true);
		expect(
			shouldShowHealthyOfflineStatus({
				isBrowserOnline: false,
				isReadOnly: false,
				stateKind: "saving",
			}),
		).toBe(true);
		for (const stateKind of [
			"loading",
			"first-run",
			"projects",
			"persist-failed",
			"recovery-needed",
			"history-recovery-needed",
		] as const) {
			expect(
				shouldShowHealthyOfflineStatus({
					isBrowserOnline: false,
					isReadOnly: false,
					stateKind,
				}),
			).toBe(false);
		}
		expect(
			shouldShowHealthyOfflineStatus({
				isBrowserOnline: true,
				isReadOnly: false,
				stateKind: "saved",
			}),
		).toBe(false);
		expect(
			shouldShowHealthyOfflineStatus({
				isBrowserOnline: false,
				isReadOnly: true,
				stateKind: "saved",
			}),
		).toBe(false);
	});
});

describe("custom GLB preview dimensions", () => {
	it("applies measured bounds only until the user enters their own dimensions", () => {
		const userDimensions = {
			depthMm: "400",
			heightMm: "300",
			widthMm: "500",
		};
		const measuredDimensions = {
			depthMm: 1800,
			heightMm: 900,
			widthMm: 2000,
		};

		expect(
			dimensionsAfterCustomGlbPreviewMeasurement(
				userDimensions,
				measuredDimensions,
				false,
			),
		).toEqual({
			depthMm: "1800",
			heightMm: "900",
			widthMm: "2000",
		});
		expect(
			dimensionsAfterCustomGlbPreviewMeasurement(
				userDimensions,
				measuredDimensions,
				true,
			),
		).toBe(userDimensions);
	});
});

describe("project revision draft boundary", () => {
	it("keeps a draft only while its exact durable Project snapshot remains current", () => {
		const current = createInitialProject({
			createdAt: "2026-08-28T10:00:00.000Z",
			levelId: "level-draft-boundary",
			name: "Граница черновика",
			projectId: "project-draft-boundary",
		});

		expect(hasProjectRevisionChanged(current, current)).toBe(false);
		expect(hasProjectRevisionChanged(current, { ...current })).toBe(true);
	});
});

function legacyFixtureController(): ProjectController {
	const snapshot: ProjectScreenState = {
		kind: "saved",
		project: {
			assetDefinitionRefs: [],
			assetInstances: [],
			createdAt: "2026-08-06T13:00:00.000Z",
			level: {
				levelId: "level-v2",
				openings: [],
				roomMetadata: [],
				vertices: [],
				wallSegments: [],
			},
			lifecycle: "active",
			name: "Архивный план",
			projectId: "project-v2",
			schemaVersion: 2,
			updatedAt: "2026-08-06T13:00:00.000Z",
		},
		projectName: "Архивный план",
		revisionId: "revision-v2",
	};
	return {
		open: async () => undefined,
		sessionHistory: () => ({ canRedo: true, canUndo: true }),
		snapshot: () => snapshot,
		subscribe: () => () => undefined,
		writerAccess: () => ({ kind: "not-ready" as const }),
	} as unknown as ProjectController;
}

function rectangularFixtureController(): ProjectController {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-22T10:00:00.000Z",
			levelId: "level-rectangular",
			name: "Гостиная",
			projectId: "project-rectangular",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		{
			next: (() => {
				const values = [
					"v-1",
					"v-2",
					"v-3",
					"v-4",
					"wall-1",
					"wall-2",
					"wall-3",
					"wall-4",
					"room-1",
				];
				let index = 0;
				return () => values[index++] ?? "unexpected";
			})(),
		},
		"2026-08-22T10:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected rectangular fixture to be valid");
	}
	return {
		open: async () => undefined,
		sessionHistory: () => ({ canRedo: false, canUndo: false }),
		snapshot: () => ({
			kind: "saved" as const,
			project: configured.project,
			revisionId: "revision-rectangular",
		}),
		subscribe: () => () => undefined,
		writerAccess: () => ({ kind: "not-ready" as const }),
	} as unknown as ProjectController;
}

function readOnlyEmptyFixtureController(): ProjectController {
	const project = createInitialProject({
		createdAt: "2026-08-27T08:00:00.000Z",
		levelId: "level-read-only",
		name: "Только просмотр",
		projectId: "project-read-only",
	});
	return {
		open: async () => undefined,
		sessionHistory: () => ({ canRedo: false, canUndo: false }),
		snapshot: () => ({
			kind: "saved" as const,
			project,
			projectName: project.name,
			revisionId: "revision-read-only",
		}),
		subscribe: () => () => undefined,
		writerAccess: () => ({
			kind: "read-only" as const,
			reasonCode: "WRITER_LEASE_HELD" as const,
		}),
		writerRecoveryCopy: () => undefined,
	} as unknown as ProjectController;
}

describe("AppShell rectangular plan measurements", () => {
	it("renders one accessible raw-mm inspector with an explicit apply action and perimeter", () => {
		const markup = renderToStaticMarkup(
			<AppShell controller={rectangularFixtureController()} />,
		);

		expect(markup).toContain('aria-label="Точные размеры плана"');
		expect(markup).toContain("Ширина, мм");
		expect(markup).toContain("Глубина, мм");
		expect(markup).toContain("Высота, мм");
		expect(markup).toContain("Применить размеры");
		expect(markup).toContain("<dt>Периметр</dt>");
		expect(markup).toContain("14000 мм");
		expect(markup).toContain("Периметр: 14000 мм");
		expect(markup).toContain('aria-label="Вернуться к проектам"');
		expect(markup).toContain("Сохранено локально");
		expect(markup).toContain(">Сохранено</span>");
		expect(markup).not.toContain("Сохранить PNG");
		expect(markup).not.toContain("Поделиться или сохранить PNG");
	});
});

describe("AppShell project transfer surface", () => {
	it("offers the explicitly selected registered transfer ingress alongside the existing browser import only when enabled", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({ kind: "projects", projects: [{ projectId: "transfer-project", revisionId: "transfer-revision", name: "Для переноса", updatedAt: "2026-11-04T20:00:00.000Z" }] }),
			persistenceRetryPolicy: () => "allowed",
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" }),
		} as unknown as ProjectController;
		const before = renderToStaticMarkup(<AppShell controller={controller} />);
		const enabled = renderToStaticMarkup(<AppShell controller={controller} registeredTransferImport registeredTransferExport />);
		const exportOnly = renderToStaticMarkup(<AppShell controller={controller} registeredTransferExport />);
		expect(exportOnly).toContain("Экспорт файла для переноса");
		expect(exportOnly).not.toContain("Импорт файла для переноса");
		expect(before).not.toContain("Импорт файла для переноса");
		expect(before).not.toContain("Экспорт файла для переноса");
		expect(enabled).toContain("Экспорт файла для переноса");
		expect(enabled).toContain("Экспортировать проект Для переноса");
		expect(enabled).toContain("Импорт файла для переноса");
		expect(enabled).toContain("Импортировать проект");
		expect(enabled).not.toContain("Синхронизировать");
	});
	it("keeps one project transfer route and no longer exposes Focus or Backup controls", () => {
		const markup = renderToStaticMarkup(
			<AppShell controller={rectangularFixtureController()} />,
		);

		expect(markup).toContain("Экспортировать проект");
		expect(markup).not.toContain("Резервная копия");
		expect(markup).not.toContain("Войти в Фокус");
		expect(markup).not.toContain("Выйти из Фокуса");
	});

	it("distinguishes unavailable verification from corruption and translates registered backup reasons", () => {
		for (const reason of ["PROJECT_JSON_CHECKSUM_MISMATCH", "PORTABLE_BACKUP_CHECKSUM_MISMATCH", "BACKUP_CHECKSUM_MISMATCH"]) {
			expect(projectTransferImportFeedback(reason)).toBe("Контрольная сумма файла не совпала. Передайте исходный файл заново.");
		}
		expect(projectTransferImportFeedback("UNSUPPORTED")).toBe("Не удалось проверить файл проекта. Существующие проекты не изменены.");
		expect(projectTransferImportFeedback("BACKUP_SCHEMA_UNREADABLE")).toContain("Не удалось безопасно определить формат файла");
		expect(projectTransferImportFeedback("verification-unavailable")).toBe(
			"Проверка этого файла сейчас недоступна. Повторите попытку или обновите приложение. Исходный файл и существующие проекты не изменены.",
		);
		for (const [registered, browser] of [
			["BACKUP_CANCELLED", "PORTABLE_BACKUP_CANCELLED"],
			["BACKUP_LIMIT_EXCEEDED", "PORTABLE_BACKUP_LIMIT_EXCEEDED"],
			["BACKUP_CHECKSUM_MISMATCH", "PORTABLE_BACKUP_CHECKSUM_MISMATCH"],
		]) expect(projectTransferImportFeedback(registered)).toBe(projectTransferImportFeedback(browser));
	});

	it("explains cancellation, a future schema and a bounded-phone limit without implying partial publication", () => {
		expect(projectTransferImportFeedback("PORTABLE_BACKUP_CANCELLED")).toBe(
			"Импорт отменён. Существующие проекты не изменены.",
		);
		expect(
			projectTransferImportFeedback("PORTABLE_BACKUP_FUTURE_SCHEMA"),
		).toContain("более новой версией приложения");
		expect(
			projectTransferImportFeedback("PORTABLE_BACKUP_LIMIT_EXCEEDED"),
		).toContain("безопасный размер или количество файлов");
	});
});

describe("catalog result count copy", () => {
	it("uses the Russian singular, paucal, teen and plural forms", () => {
		expect(itemCountCopy(0)).toBe("0 предметов");
		expect(catalogResultCountCopy(1)).toBe("1 предмет");
		expect(catalogResultCountCopy(2)).toBe("2 предмета");
		expect(itemCountCopy(3)).toBe("3 предмета");
		expect(catalogResultCountCopy(4)).toBe("4 предмета");
		expect(catalogResultCountCopy(5)).toBe("5 предметов");
		expect(catalogResultCountCopy(11)).toBe("11 предметов");
		expect(itemCountCopy(12)).toBe("12 предметов");
		expect(itemCountCopy(14)).toBe("14 предметов");
		expect(catalogResultCountCopy(21)).toBe("21 предмет");
		expect(itemCountCopy(24)).toBe("24 предмета");
	});
});

describe("preloaded GLB preparation copy", () => {
	it("shows an exact known percentage without inventing one for an unknown total", () => {
		expect(
			preloadedGlbLoadingStatusCopy({ loadedBytes: 64, totalBytes: 100 }),
		).toBe("Готовим для офлайн… 64%");
		expect(preloadedGlbLoadingStatusCopy({ loadedBytes: 64 })).toBe(
			"Готовим для офлайн…",
		);
	});
});

describe("AppShell legacy V2 guard", () => {
	it("keeps a persisted V2 fixture observable but exposes no editor mutation controls", () => {
		const markup = renderToStaticMarkup(
			<AppShell controller={legacyFixtureController()} />,
		);

		expect(markup).toContain(
			"Этот архивный формат доступен только для просмотра",
		);
		expect(markup).toContain('data-testid="legacy-read-only"');
		expect(markup).toContain('data-testid="project-durability-status"');
		expect(markup).toContain('data-view-mode="plan"');
		expect(markup).toMatch(
			/data-testid="project-durability-status"[^>]*data-visible-status="true"[^>]*>Сохранено локально/,
		);
		expect(markup).toMatch(/aria-label="Стена"[^>]*disabled=""/);
		expect(markup).toMatch(
			/<button[^>]*aria-label="Предметы интерьера"[^>]*disabled=""[^>]*>/,
		);
		expect(markup).toContain('aria-label="Рука и выбор"');
		expect(markup).toContain('data-testid="select-tool-icon"');
		expect(markup).toContain('data-testid="wall-tool-icon"');
		expect(markup).toContain('data-testid="catalog-tool-icon"');
		expect(markup).toContain('data-testid="more-actions-icon"');
		expect(markup).not.toContain("🐾");
		expect(markup).not.toContain("На весь экран");
		expect(markup).toMatch(/aria-label="Отменить действие"[^>]*disabled=""/);
	});
});

describe("AppShell phone editor chrome", () => {
	it("keeps Plan/3D and the three direct creation actions in a compact mobile shell", () => {
		const markup = renderToStaticMarkup(
			<AppShell controller={rectangularFixtureController()} />,
		);

		expect(markup).toContain('data-testid="editor-top-bar"');
		expect(markup).toContain('aria-label="Переключить вид редактора"');
		expect(markup).toContain('data-testid="editor-view-switch"');
		expect(markup).toContain('data-testid="editor-action-dock"');
		expect(markup).toContain('aria-label="Рука и выбор"');
		expect(markup).toContain('aria-label="Стена"');
		expect(markup).toContain('aria-label="Предметы интерьера"');
		expect(markup).toContain('aria-label="Открыть остальные действия"');
		expect(markup).toContain('data-testid="wall-tool-icon"');
		expect(markup).toContain('data-testid="catalog-tool-icon"');
		expect(markup).toContain('data-testid="more-actions-icon"');
		expect(markup).toContain('data-testid="rooms-directory-icon"');
		expect(markup).toContain('data-testid="plan-dimensions-icon"');
		expect(markup).not.toContain("revision-rectangular");
	});
});

describe("AppShell PWA update safety", () => {
	it("keeps an installed update visible but disabled until the current revision is durable", () => {
		const savedSnapshot = legacyFixtureController().snapshot();
		if (savedSnapshot.kind !== "saved") {
			throw new Error("Expected saved fixture");
		}
		const savingSnapshot: ProjectScreenState = {
			kind: "saving",
			project: savedSnapshot.project,
			revisionId: "revision-v2",
		};
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => savingSnapshot,
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(
			<AppShell
				controller={controller}
				pwaUpdate={{
					activate: () => undefined,
					isReloadReady: false,
					isWaiting: true,
					reload: () => undefined,
				}}
			/>,
		);

		expect(markup).toContain("Обновление готово");
		expect(markup).toContain("после завершения сохранения");
		expect(markup).toMatch(
			/<button[^>]*disabled=""[^>]*>Обновить приложение<\/button>/,
		);
	});
});

describe("AppShell project directory", () => {
	it("renders a compact local timestamp and falls back safely when a legacy record is malformed", () => {
		expect(projectDirectoryUpdatedCopy("2026-08-18T12:00:00.000Z")).toMatch(
			/^Изменён · \d/,
		);
		expect(
			projectDirectoryUpdatedCopy("2026-08-18T12:00:00.000Z"),
		).not.toContain("T12:00:00");
		expect(projectDirectoryUpdatedCopy("not-a-timestamp")).toBe(
			"Изменён недавно",
		);
	});

	it("groups the phone project hub into creation, transfer and project-list surfaces", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({
				kind: "projects" as const,
				projects: [
					{
						name: "План A",
						projectId: "project-a",
						revisionId: "revision-a",
						updatedAt: "2026-08-18T12:00:00.000Z",
					},
				],
			}),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).toContain('data-testid="project-hub"');
		expect(markup).toContain('data-testid="project-hub-actions"');
		expect(markup).toContain('data-testid="project-directory"');
		expect(markup).toContain('aria-label="Открыть План A"');
		expect(markup).toContain('aria-label="Действия для План A"');
		expect(markup).toContain("<details><summary");
		expect(markup).toContain("Изменён ·");
		expect(markup).not.toContain("2026-08-18T12:00:00.000Z");
	});

	it("does not offer an independent project duplicate action", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({
				kind: "projects" as const,
				projects: [
					{
						name: "План A",
						projectId: "project-a",
						revisionId: "revision-a",
						updatedAt: "2026-08-18T12:00:00.000Z",
					},
				],
			}),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).not.toContain('aria-label="Дублировать вариант План A"');
		expect(markup).not.toContain(">Дублировать<");
	});

	it("offers only direct irreversible Project deletion and no recoverable removal surface", () => {
		const markup = renderToStaticMarkup(
			<AppShell controller={rectangularFixtureController()} />,
		);

		expect(markup).toContain(">Удалить проект<");
		expect(markup).not.toContain("Корзина");
		expect(markup).not.toContain("В корзину");
		expect(markup).not.toContain("Восстановить");
	});
});

describe("AppShell Projects-first entry", () => {
	it("keeps recovery-file import available in Web/PWA while the healthy Telegram hub shows no diagnostics or unsaved-draft restore", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({ kind: "projects" as const, projects: [] }),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;
		const web = renderToStaticMarkup(<AppShell controller={controller} />);
		expect(web).toContain("Восстановить несохранённую правку");
		const telegram = renderToStaticMarkup(<AppShell controller={controller} diagnosticDetails={<p>Данные для проверки</p>} hostNavigation={{ close: () => undefined, subscribeBack: () => () => undefined, setBackVisible: () => undefined }} />);
		expect(telegram).toContain("Новый проект");
		expect(telegram).toContain("Импортировать проект");
		expect(telegram).not.toContain("Восстановить несохранённую правку");
		expect(telegram).not.toContain("Выбрать файл несохранённой правки");
		expect(telegram).not.toContain("Данные для проверки");
	});

	it("renders a calm empty Projects hub with explicit creation and import routes", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({ kind: "projects" as const, projects: [] }),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).toContain('data-testid="project-hub"');
		expect(markup).toContain('data-testid="project-directory-empty"');
		expect(markup).toContain("Пока нет проектов");
		expect(markup).toContain(">Новый проект<");
		expect(markup).toContain(">Импортировать проект<");
		expect(markup).not.toContain("Начнём с пространства");
		expect(markup).not.toContain("INTERIORS · ЛОКАЛЬНО");
	});

	it("keeps creation as an explicit returnable route from the Projects hub", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({ kind: "first-run" as const }),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).toContain('aria-label="Вернуться к проектам"');
		expect(markup).toContain(">Новый проект</h1>");
		expect(markup).not.toContain("Начнём с пространства");
	});
});

describe("AppShell custom-resource recovery", () => {
	it("keeps ordinary first-run onboarding distinct from the recovery-only screen", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({ kind: "first-run" as const }),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).toContain("Новый проект");
		expect(markup).not.toContain('data-testid="resource-recovery-diagnostic"');
	});

	it("lets a recovery-needed project select one complete set of original GLBs", () => {
		const controller = {
			open: async () => undefined,
			recoveryCustomGlbRemovalSummary: () => ({
				affectedAssetDefinitionCount: 2,
				affectedAssetInstanceCount: 3,
			}),
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({
				kind: "recovery-needed" as const,
				reasonCode: "PERSISTENCE_CORRUPT" as const,
			}),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).toContain("Проект требует восстановления");
		expect(markup).toContain(
			"Некоторые модели отсутствуют или повреждены. Редактирование остановлено.",
		);
		expect(markup).toContain('data-testid="resource-recovery-diagnostic"');
		expect(markup).not.toContain("Начнём с пространства");
		expect(markup).toContain(
			'aria-label="Выбрать исходные GLB-модели для восстановления"',
		);
		expect(markup).toMatch(
			/<input(?=[^>]*multiple="")(?=[^>]*type="file")[^>]*>/,
		);
		expect(markup).toContain("Восстановить исходные GLB");
		expect(markup).toContain("Размещённых предметов: 3");
		expect(markup).toContain("Удалить все недоступные модели");
		expect(markup).toContain("Это действие нельзя отменить через историю");
	});

	it("keeps a healthy current plan visible but read-only when only session history has a resource issue", () => {
		const durable = rectangularFixtureController().snapshot();
		if (durable.kind !== "saved") {
			throw new Error("Expected a durable rectangular fixture.");
		}
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: true, canUndo: true }),
			snapshot: () => ({
				kind: "history-recovery-needed" as const,
				project: durable.project,
				projectName: durable.projectName,
				resourceHashes: ["b".repeat(64)],
				revisionId: durable.revisionId,
			}),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "writable" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).toContain('data-testid="history-resource-recovery-notice"');
		expect(markup).toContain("Текущий план сохранён и доступен для экспорта");
		expect(markup).toContain("Проверить историю снова");
		expect(markup).toContain("Очистить историю");
		expect(markup).toMatch(/aria-label="Отменить действие"[^>]*disabled=""/);
		expect(markup).toMatch(/aria-label="Повторить действие"[^>]*disabled=""/);
		expect(markup).toMatch(/aria-label="Стена"[^>]*disabled=""/);
	});
});

describe("AppShell install action without tutorial hints", () => {
	it("offers the browser install action before first project creation without tutorial prose", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({ kind: "first-run" as const }),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(
			<AppShell
				controller={controller}
				pwaInstall={{
					canUseIosShareInstall: false,
					isStandalone: false,
					promptInstall: async () => "accepted",
				}}
			/>,
		);

		expect(markup).toContain("Установить приложение");
		expect(markup).not.toContain("не синхронизируются автоматически");
		expect(markup).not.toContain(
			"<details><summary>Работайте как в приложении</summary>",
		);
		expect(markup).not.toContain("Точные мм · хранится на устройстве");
		expect(markup).not.toContain('data-testid="first-run-help"');
		expect(markup).not.toContain("Как это работает");
		expect(markup).not.toContain("Совет по построению");
		expect(markup).not.toContain("Совет по размерам");
		expect(markup).not.toContain("Совет по 3D");
	});

	it("does not show permanent installation instructions when no direct prompt exists", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => ({ kind: "first-run" as const }),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(
			<AppShell
				controller={controller}
				pwaInstall={{
					canUseIosShareInstall: true,
					isStandalone: false,
				}}
			/>,
		);

		expect(markup).not.toContain("На экран «Домой»");
		expect(markup).not.toContain("Установить приложение");
		expect(markup).not.toContain("Portable Backup");
		expect(markup).not.toContain("перенесите проект");
	});
});

describe("project-name validation feedback", () => {
	it("explains a malformed Unicode name without treating it as a missing name", () => {
		expect(projectNameErrorCopy("PROJECT_NAME_INVALID_UNICODE")).toContain(
			"недопустимый символ",
		);
		expect(projectNameErrorCopy("PROJECT_NAME_REQUIRED")).toBe(
			"Введите название проекта.",
		);
	});
});

describe("AppShell writer lease safety", () => {
	it("makes a held project visibly read-only and offers an explicit takeover", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => legacyFixtureController().snapshot(),
			subscribe: () => () => undefined,
			takeOverWriterLease: async () => ({ kind: "writable" as const }),
			writerAccess: () => ({
				kind: "read-only" as const,
				reasonCode: "WRITER_LEASE_HELD" as const,
			}),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).toContain("Проект открыт в другом окне");
		expect(markup).toContain("Взять редактирование на себя");
		expect(markup).toContain('data-testid="writer-lease-notice"');
	});

	it("exports an unpublished recovery copy after losing writer ownership", () => {
		const controller = {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => legacyFixtureController().snapshot(),
			subscribe: () => () => undefined,
			writerRecoveryCopy: () => ({
				project: legacyFixtureController().snapshot(),
			}),
			writerAccess: () => ({
				kind: "read-only" as const,
				reasonCode: "WRITER_LEASE_HELD" as const,
			}),
		} as unknown as ProjectController;
		const markup = renderToStaticMarkup(<AppShell controller={controller} />);
		expect(markup).toContain("Скачать несохранённую правку");
	});

	it("disables every initial-contour mutation control in a writer read-only context", () => {
		const markup = renderToStaticMarkup(
			<AppShell controller={readOnlyEmptyFixtureController()} />,
		);
		const contourForm = markup.slice(
			markup.indexOf('aria-label="Размеры стартового контура"'),
			markup.indexOf(
				"</form>",
				markup.indexOf('aria-label="Размеры стартового контура"'),
			),
		);

		expect(contourForm.match(/disabled=""/g)).toHaveLength(4);
	});
});

describe("confirmed wall draft ownership", () => {
	it("hands durable and retry-pending candidates out of the cancellable transient UI", () => {
		expect(shouldConsumeConfirmedWallDraft({ kind: "durable" })).toBe(true);
		expect(shouldConsumeConfirmedWallDraft({ kind: "persist-failed" })).toBe(
			true,
		);
	});

	it("keeps a draft when publication never accepted ownership of its candidate", () => {
		expect(shouldConsumeConfirmedWallDraft({ kind: "in-progress" })).toBe(
			false,
		);
		expect(shouldConsumeConfirmedWallDraft({ kind: "not-ready" })).toBe(false);
		expect(shouldConsumeConfirmedWallDraft({ kind: "rejected" })).toBe(false);
	});
});

describe("item placement feedback", () => {
	it("never leaves a rejected or deferred placement without a user-visible explanation", () => {
		expect(itemPlacementFeedback({ kind: "in-progress" })).toContain(
			"сохраняется",
		);
		expect(itemPlacementFeedback({ kind: "not-ready" })).toContain(
			"открывается",
		);
		expect(
			itemPlacementFeedback({
				kind: "persist-failed",
				reasonCode: "PERSISTENCE_WRITE_FAILED",
			}),
		).toContain("Не удалось сохранить");
		expect(
			itemPlacementFeedback({
				kind: "rejected",
				reasonCode: "OUTSIDE_ROOM_HOST",
			}),
		).toContain("целиком находиться");
		expect(itemPlacementFeedback({ kind: "rejected" })).toContain(
			"нельзя разместить",
		);
		expect(itemPlacementFeedback({ kind: "unexpected-state" })).toContain(
			"пока нельзя",
		);
		expect(itemPlacementFeedback({ kind: "durable" })).toBe(
			"Предмет размещён и сохранён.",
		);
	});
});

describe("wall mutation correction", () => {
	it("names a rejected opening and preserves its direct numeric correction path", () => {
		const configured = configureRectangularRoom(
			createInitialProject({
				createdAt: "2026-08-28T10:00:00.000Z",
				levelId: "level-opening-correction",
				name: "Проём для исправления",
				projectId: "project-opening-correction",
			}),
			{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
			{
				next: (() => {
					const values = [
						"v-1",
						"v-2",
						"v-3",
						"v-4",
						"wall-1",
						"wall-2",
						"wall-3",
						"wall-4",
						"room-1",
					];
					let index = 0;
					return () => values[index++] ?? "unexpected";
				})(),
			},
			"2026-08-28T10:01:00.000Z",
		);
		if (configured.kind !== "accepted") {
			throw new Error("Expected a valid correction fixture");
		}
		const project: Project = {
			...configured.project,
			level: {
				...configured.project.level,
				openings: [
					{
						heightMm: 2100,
						kind: "Door",
						offsetMm: 2000,
						openingId: "door-1",
						sillMm: 0,
						swingSide: "right",
						wallSegmentId: "wall-1",
						widthMm: 900,
					},
				],
			},
		};

		expect(
			wallMutationCorrection(
				{
					affected: { kind: "opening", openingId: "door-1" },
					reasonCode: "WALL_DOOR_OPENING_COLLISION",
				},
				project,
			),
		).toEqual({
			kind: "opening",
			message:
				"Стена пересекает Дверной проём № 1 на выбранной стене. Откройте проём, чтобы изменить его, или проведите стену иначе.",
			opening: project.level.openings[0],
		});
		expect(
			wallMutationCorrection(
				{
					affected: { kind: "opening", openingId: "missing-opening" },
					reasonCode: "WALL_DOOR_OPENING_COLLISION",
				},
				project,
			),
		).toBeUndefined();
		expect(
			wallMutationCorrection(
				{
					affected: { kind: "opening", openingId: "door-1" },
					reasonCode: "WALL_ITEM_COLLISION",
				},
				project,
			),
		).toBeUndefined();

		const projectWithOtherOpenings: Project = {
			...project,
			level: {
				...project.level,
				openings: [
					{
						heightMm: 1200,
						kind: "Window",
						offsetMm: 1500,
						openingId: "window-other-wall",
						sillMm: 900,
						wallSegmentId: "wall-2",
						widthMm: 800,
					},
					...project.level.openings,
					{
						heightMm: 1200,
						kind: "Window",
						offsetMm: 1000,
						openingId: "window-1",
						sillMm: 900,
						wallSegmentId: "wall-1",
						widthMm: 800,
					},
				],
			},
		};
		expect(
			wallMutationCorrection(
				{
					affected: { kind: "opening", openingId: "window-1" },
					reasonCode: "WALL_DOOR_OPENING_COLLISION",
				},
				projectWithOtherOpenings,
			),
		).toEqual({
			kind: "opening",
			message:
				"Стена пересекает Окно № 2 на выбранной стене. Откройте окно, чтобы изменить его, или проведите стену иначе.",
			opening: projectWithOtherOpenings.level.openings[2],
		});
	});
});

describe("item placement preview feedback", () => {
	it("names the current collision or valid placement before the user presses Поставить", () => {
		expect(
			itemPlacementWarningSummary([
				{ assetInstanceId: "item-1", kind: "item" },
				{ kind: "door-clearance", openingId: "door-1" },
				{ assetInstanceId: "item-2", kind: "item" },
			]),
		).toBe("пересечение с другим предметом; перекрытие зоны открывания двери");
		expect(
			itemPlacementPreviewFeedback({
				isValid: true,
				warnings: [{ assetInstanceId: "item-1", kind: "item" }],
			}),
		).toBe("Предупреждение: пересечение с другим предметом.");
		expect(
			itemPlacementPreviewFeedback({
				isValid: false,
				reasonCode: "WALL_ITEM_COLLISION",
			}),
		).toBe("Предпросмотр пересекает стену.");
		expect(
			itemPlacementPreviewFeedback({
				isValid: true,
				warnings: [{ kind: "door-clearance", openingId: "door-1" }],
			}),
		).toBe("Предупреждение: перекрытие зоны открывания двери.");
		expect(
			itemPlacementPreviewFeedback({
				isValid: true,
				warnings: [
					{ assetInstanceId: "item-1", kind: "item" },
					{ kind: "door-clearance", openingId: "door-1" },
				],
			}),
		).toBe(
			"Предупреждение: пересечение с другим предметом; перекрытие зоны открывания двери.",
		);
		expect(itemPlacementPreviewFeedback({ isValid: false, warnings: [] })).toBe(
			"Это размещение пока недоступно.",
		);
		expect(
			itemPlacementPreviewFeedback({
				isValid: false,
				reasonCode: "OUTSIDE_ROOM_HOST",
			}),
		).toBe("Предпросмотр выходит за границы комнаты.");
		expect(itemPlacementPreviewFeedback({ isValid: false })).toBe(
			"Это размещение пока недоступно.",
		);
		expect(itemPlacementPreviewFeedback({ isValid: true })).toBe("");
		expect(
			itemPlacementPreviewFeedback(
				{ isValid: true },
				{ isPreparingResource: true },
			),
		).toBe("Подготавливаем модель…");
	});
});

describe("persistence failure copy", () => {
	it("names the session-history limit and an explicit new history boundary", () => {
		expect(persistenceFailureCopy("PROJECT_HISTORY_RESOURCE_LIMIT")).toContain(
			"Закройте и заново откройте проект",
		);
		expect(
			renamePersistenceFailureCopy("PROJECT_HISTORY_RESOURCE_LIMIT"),
		).toContain("Закройте и заново откройте проект");
	});

	it("keeps generic persistence feedback truthful for non-rename mutations", () => {
		expect(persistenceFailureCopy("PERSISTENCE_WRITE_FAILED")).toContain(
			"Сохранённый план не изменён",
		);
		expect(persistenceFailureCopy("PERSISTENCE_WRITE_FAILED")).not.toContain(
			"название",
		);
		expect(renamePersistenceFailureCopy("PERSISTENCE_WRITE_FAILED")).toBe(
			"Прежнее название не изменено. Не удалось сохранить правку — повторите действие.",
		);
	});

	it("directs a quota failure to export while retaining the durable plan", () => {
		expect(persistenceFailureCopy("PERSISTENCE_QUOTA_EXCEEDED")).toContain(
			"недостаточно места",
		);
		expect(persistenceFailureCopy("PERSISTENCE_QUOTA_EXCEEDED")).toContain(
			"экспортируйте проект",
		);
		expect(
			renamePersistenceFailureCopy("PERSISTENCE_QUOTA_EXCEEDED"),
		).toContain("недостаточно места");
	});

	it("renders reopening instead of a futile retry for the history-resource limit", () => {
		const durable = rectangularFixtureController().snapshot();
		if (durable.kind !== "saved") {
			throw new Error("Expected the rectangular fixture to be durable.");
		}
		const controller = {
			open: async () => undefined,
			retry: async () => undefined,
			sessionHistory: () => ({ canRedo: true, canUndo: true }),
			snapshot: () => ({
				kind: "persist-failed" as const,
				project: durable.project,
				reasonCode: "PROJECT_HISTORY_RESOURCE_LIMIT" as const,
				revisionId: durable.revisionId,
			}),
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;

		const markup = renderToStaticMarkup(<AppShell controller={controller} />);

		expect(markup).toContain("Открыть проект заново");
		expect(markup).not.toContain("Повторить сохранение");
	});
});

describe("session-history discard feedback", () => {
	it("keeps the current Project distinct from a history-only resource issue", () => {
		expect(historyDiscardFailureCopy("current-resource-issue")).toContain(
			"Текущий план тоже требует восстановления",
		);
		expect(historyDiscardFailureCopy("read-only")).toContain("другом окне");
		expect(historyDiscardFailureCopy("not-ready")).toContain(
			"История не изменена",
		);
	});
});

describe("FBX conversion feedback", () => {
	it("explains every safe refusal without claiming that a model was imported", () => {
		expect(fbxConversionFeedback("FBX_ARCHIVE_INVALID")).toContain("ZIP-архив");
		expect(fbxConversionFeedback("FBX_ARCHIVE_RESOURCE_LIMIT")).toContain(
			"слишком много файлов",
		);
		expect(fbxConversionFeedback("FBX_FILE_BYTES_LIMIT")).toContain("12 MiB");
		expect(fbxConversionFeedback("FBX_EXTERNAL_RESOURCE")).toContain(
			"JPG, PNG или WebP",
		);
		expect(fbxConversionFeedback("FBX_SIDECAR_BYTES_LIMIT")).toContain(
			"13 MiB",
		);
		expect(fbxConversionFeedback("FBX_UNSUPPORTED_SCENE_CONTENT")).toContain(
			"анимации",
		);
		expect(fbxConversionFeedback("FBX_CONVERSION_TIMEOUT")).toContain(
			"15 секунд",
		);
	});
});

describe("wall mutation feedback", () => {
	it("does not mislabel a rejected diagonal topology as a millimetre input error", () => {
		expect(errorCopy("INVALID_PLAN_GRAPH").toLowerCase()).toContain("контур");
		expect(errorCopy("UNSUPPORTED_FACE_SHAPE").toLowerCase()).toContain(
			"контур",
		);
		expect(errorCopy("INVALID_PLAN_GRAPH")).not.toContain("миллиметры");
	});

	it("uses canonical thickness reasons and mutation-neutral host recovery copy", () => {
		expect(wallThicknessErrorCopy("INVALID_DIMENSION")).toContain(
			"целым числом",
		);
		expect(wallThicknessErrorCopy("PROJECT_BOUNDS_EXCEEDED")).toContain(
			"20–1000 мм",
		);
		expect(errorCopy("USABLE_POLYGON_COLLAPSED")).toContain("контур комнаты");
		expect(errorCopy("ITEM_HOST_UNRESOLVABLE")).not.toContain("Удаление");
		expect(errorCopy("OPENING_HOST_UNRESOLVABLE")).not.toContain("Удаление");
	});

	it("localizes the canonical add-wall validation reasons", () => {
		expect(errorCopy("ASSET_DEFINITION_NOT_PINNED")).toContain("ресурс");
		expect(errorCopy("INVALID_DIMENSION")).toContain("целые положительные");
		expect(errorCopy("PROJECT_BOUNDS_EXCEEDED")).toContain("границы проекта");
		expect(errorCopy("ZERO_LENGTH")).toContain("ненулевой длиной");
	});

	it("keeps an unknown rejection distinct from a canonical dimension error", () => {
		expect(errorCopy("UNKNOWN_REASON_CODE")).toContain("Не удалось применить");
	});
});

it("explains a wall-model overlap using wall placement language", () => {
	expect(
		itemPlacementWarningSummary([
			{ kind: "wall-item", assetInstanceId: "sconce" },
		]),
	).toBe("пересечение с другим настенным предметом");
});


it("explains an unrepresentable browser transfer without accusing source corruption and offers reselection instead of retry",()=>{
 expect(projectTransferImportFeedback("PROJECT_BACKUP_ENVELOPE_EXCEEDED")).toBe("Текущий формат резервной копии в браузере не сохраняет эти данные точно. Исходный файл и существующие проекты не изменены.");
 expect(persistenceFailureActionCopy("PERSISTENCE_QUOTA_EXCEEDED","registered-transfer-reselection-required")).toBe("Выбрать исходный файл снова");
 expect(persistenceFailureActionCopy("PROJECT_HISTORY_RESOURCE_LIMIT","allowed")).toBe("Открыть проект заново");
 expect(persistenceFailureActionCopy("PERSISTENCE_QUOTA_EXCEEDED","allowed")).toBe("Повторить сохранение");
});


describe("AppShell scoped browser directory", () => {
	function directory(state: Extract<ProjectScreenState, { kind: "projects" }>) {
		return {
			open: async () => undefined,
			sessionHistory: () => ({ canRedo: false, canUndo: false }),
			snapshot: () => state,
			subscribe: () => () => undefined,
			writerAccess: () => ({ kind: "not-ready" as const }),
		} as unknown as ProjectController;
	}
	it("distinguishes same-name same-ID cards by their trusted local source and spoken copy label", () => {
		const summary = { name: "Совпавший план", projectId: "same-id", revisionId: "r1", updatedAt: "2026-11-04T12:00:00.000Z" };
		const markup = renderToStaticMarkup(<AppShell controller={directory({
			kind: "projects", storageSources: [{ storageNamespace: "legacy", kind: "available" }, { storageNamespace: "browser-registered", kind: "available" }],
			projects: [{ ...summary, storageNamespace: "legacy" }, { ...summary, storageNamespace: "browser-registered" }],
		})} />);
		expect(markup).toContain("На этом устройстве · обычное хранилище");
		expect(markup).toContain("На этом устройстве · хранилище для переноса");
		expect(markup).toContain('data-project-storage="legacy"');
		expect(markup).toContain('data-project-storage="browser-registered"');
		expect(markup).toContain("Копия 1"); expect(markup).toContain("Копия 2");
		expect(markup).toContain('aria-label="Открыть Совпавший план · На этом устройстве · хранилище для переноса · Копия 2"');
		expect(markup).toContain("Проекты из хранилища для переноса не отображаются в старой версии");
	});
	it("does not call a partially unavailable directory empty and offers an explicit retry", () => {
		const markup = renderToStaticMarkup(<AppShell controller={directory({ kind: "projects", projects: [], storageSources: [{ storageNamespace: "legacy", kind: "available" }, { storageNamespace: "browser-registered", kind: "unavailable" }] })} />);
		expect(markup).toContain("Часть проектов сейчас недоступна");
		expect(markup).toContain('aria-label="Повторить проверку локальных хранилищ"');
		expect(markup).not.toContain("Пока нет проектов");
	});
	it("reports a currently absent new store without claiming its past was empty", () => {
		const markup = renderToStaticMarkup(<AppShell controller={directory({ kind: "projects", projects: [], storageSources: [{ storageNamespace: "legacy", kind: "available" }, { storageNamespace: "browser-registered", kind: "not-provisioned", history: "unknown" }] })} />);
		expect(markup).toContain("Хранилище для переноса сейчас не создано");
		expect(markup).toContain("История прежних данных неизвестна");
		expect(markup).not.toContain("Пока нет проектов");
	});
	it("does not offer actions for an unqualified card in a scoped directory", () => {
		const markup = renderToStaticMarkup(<AppShell controller={directory({ kind: "projects", projects: [{ name: "Неизвестный источник", projectId: "x", revisionId: "r", updatedAt: "" }], storageSources: [{ storageNamespace: "legacy", kind: "available" }] })} registeredTransferExport />);
		expect(markup).toContain("Источник проекта не подтверждён");
		expect(markup).toMatch(/aria-label="Открыть Неизвестный источник[^"]*"[^>]*disabled=""/);
		expect(markup).toMatch(/aria-label="Удалить проект Неизвестный источник[^"]*"[^>]*disabled=""/);
	});
	it("shows the ordinary empty state only after both current sources are available", () => {
		const markup = renderToStaticMarkup(<AppShell controller={directory({ kind: "projects", projects: [], storageSources: [{ storageNamespace: "legacy", kind: "available" }, { storageNamespace: "browser-registered", kind: "available" }] })} />);
		expect(markup).toContain("Пока нет проектов");
		expect(markup).not.toContain("Часть проектов сейчас недоступна");
	});
});

describe("browser navigation compatibility", () => {
	const recoveryProtection = {
		discardWriterRecoveryAndShowProjects: async () => true,
	};
	for (const storageNamespace of [undefined, "legacy"] as const) {
		it(`keeps ordinary browser Back free of host pointer interception for ${storageNamespace ?? "unselected legacy"} while retaining the recovery capability`, () => {
			const markup = renderToStaticMarkup(
				<AppShell
					controller={rectangularFixtureController()}
					editorStorageNamespace={storageNamespace}
					navigationProtection={recoveryProtection}
				/>,
			);
			expect(markup).toContain('aria-label="Вернуться к проектам"');
			expect(markup).not.toContain("data-editor-host-back");
		});
	}
	it("retains host pointer interception for a browser-registered editor", () => {
		const markup = renderToStaticMarkup(
			<AppShell
				controller={rectangularFixtureController()}
				editorStorageNamespace="browser-registered"
				navigationProtection={recoveryProtection}
			/>,
		);
		expect(markup).toContain('data-editor-host-back="back"');
	});
	it("retains Telegram Back protection regardless of the optional browser owner", () => {
		const markup = renderToStaticMarkup(
			<AppShell
				controller={rectangularFixtureController()}
				hostNavigation={{
					subscribeBack: () => () => undefined,
					setBackVisible: () => undefined,
					close: () => undefined,
				}}
			/>,
		);
		expect(markup).toContain('data-editor-host-back="back"');
	});
});

it("keeps retained-publication feedback and mutation blocking for an ordinary browser owner", () => {
	const controller = new Proxy(rectangularFixtureController(), {
		get(target, property) {
			if (property === "pendingPublicationIdentity")
				return () => ({
					projectId: "project-rectangular",
					revisionId: "retained-target",
					checksum: "0".repeat(64),
				});
			return Reflect.get(target, property, target);
		},
	});
	const markup = renderToStaticMarkup(
		<AppShell
			controller={controller}
			editorStorageNamespace="legacy"
			navigationProtection={{
				discardWriterRecoveryAndShowProjects: async () => true,
			}}
		/>,
	);
	expect(markup).toContain("Правка не сохранена");
	expect(markup).toMatch(
		/<button[^>]*aria-label="Переименовать проект Гостиная"[^>]*disabled=""/,
	);
	expect(markup).not.toContain("data-editor-host-back");
});

it("does not grant transient host behavior from a storage label without its navigation capability", () => {
	const markup = renderToStaticMarkup(
		<AppShell
			controller={rectangularFixtureController()}
			editorStorageNamespace="browser-registered"
		/>,
	);
	expect(markup).not.toContain("data-editor-host-back");
});

for(const healthy of [false,true])
 it(`preserves explicit recovery for an unreadable directory without hiding healthy cards (${healthy})`,()=>{
  const snapshot:ProjectScreenState={kind:"projects",projects:healthy?[{projectId:"healthy",revisionId:"r1",name:"Healthy neighbor",updatedAt:"2026-11-05T00:00:00.000Z",storageNamespace:"browser-registered"}]:[],recoveryNeeded:true,storageSources:[{storageNamespace:"legacy",kind:"recovery-required"},healthy?{storageNamespace:"browser-registered",kind:"available"}:{storageNamespace:"browser-registered",kind:"not-provisioned",history:"unknown"}]};
  const controller=new Proxy(rectangularFixtureController(),{get(target,property){if(property==="snapshot")return()=>snapshot;return Reflect.get(target,property,target);}});
  const html=renderToStaticMarkup(<AppShell controller={controller}/>);
  expect(html).not.toContain('data-testid="project-directory-empty"');
  if(healthy){expect(html).toContain("Healthy neighbor");expect(html).not.toContain('data-testid="project-recovery-screen"');}
  else {expect(html).toContain('data-testid="project-recovery-screen"');expect(html).toContain("Нужно восстановление");expect(html).toContain("Не удалось проверить сохранённую версию");expect(html).toContain("Повторить проверку");expect(html).not.toContain("Создать проект");}
 });

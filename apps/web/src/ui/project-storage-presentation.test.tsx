import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import {
	canShowProjectDirectoryEmpty,
	ProjectStorageStatus,
	projectDirectoryCards,
	projectDirectoryEmptyLabel,
} from "./project-storage-presentation";

describe("local project source presentation", () => {
	const summary = {
		name: "Одна копия",
		projectId: "same-id",
		revisionId: "r1",
		updatedAt: "2026-11-04T00:00:00.000Z",
	};
	it("assigns distinct view identities to same-ID sources and delimiter-like raw addresses", () => {
		const cards = projectDirectoryCards(
			[
				{ ...summary, storageNamespace: "legacy" },
				{ ...summary, storageNamespace: "browser-registered" },
				{
					...summary,
					storageNamespace: "legacy",
					projectId: 'browser-registered","same-id',
				},
				{
					...summary,
					storageNamespace: "browser-registered",
					projectId: 'legacy","same-id',
				},
			],
			true,
		);
		expect(new Set(cards.map((card) => card.key)).size).toBe(4);
		expect(cards.every((card) => card.ownerConfirmed)).toBe(true);
	});
	it("labels a unique scoped project without inventing another copy and preserves the ordinary card", () => {
		const scoped = projectDirectoryCards(
			[{ ...summary, storageNamespace: "legacy" }],
			true,
		)[0];
		expect(scoped?.copyLabel).toBeUndefined();
		expect(scoped?.ownerConfirmed).toBe(true);
		const ordinary = projectDirectoryCards([summary], false)[0];
		expect(ordinary?.ownerConfirmed).toBe(true);
		expect(ordinary?.spokenName).toBe(summary.name);
		expect(ordinary?.copyLabel).toBeUndefined();
	});
	it("requires current results from both sources before announcing a scoped directory is empty", () => {
		expect(canShowProjectDirectoryEmpty([])).toBe(false);
		expect(
			canShowProjectDirectoryEmpty([
				{ storageNamespace: "legacy", kind: "available" },
			]),
		).toBe(false);
		expect(
			canShowProjectDirectoryEmpty([
				{ storageNamespace: "browser-registered", kind: "available" },
			]),
		).toBe(false);
		expect(
			canShowProjectDirectoryEmpty([
				{ storageNamespace: "legacy", kind: "available" },
				{ storageNamespace: "browser-registered", kind: "recovery-required" },
			]),
		).toBe(false);
	});
	it("names the unavailable source and distinguishes recovery from a transient check failure", () => {
		const markup = renderToStaticMarkup(
			<ProjectStorageStatus
				sources={[
					{ storageNamespace: "legacy", kind: "unavailable" },
					{ storageNamespace: "browser-registered", kind: "recovery-required" },
				]}
				onRetry={() => undefined}
			/>,
		);
		expect(markup).toContain(
			"На этом устройстве · обычное хранилище — не удалось проверить",
		);
		expect(markup).toContain(
			"На этом устройстве · хранилище для переноса — требуется проверка и восстановление",
		);
		expect(markup).toContain(
			'aria-label="Повторить проверку локальных хранилищ"',
		);
		expect(markup).toContain(">Повторить</button>");
	});
	it("does not report a currently existing source as unprovisioned", () => {
		const markup = renderToStaticMarkup(
			<ProjectStorageStatus
				sources={[
					{ storageNamespace: "legacy", kind: "available" },
					{ storageNamespace: "browser-registered", kind: "available" },
				]}
				onRetry={() => undefined}
			/>,
		);
		expect(markup).not.toContain("Хранилище для переноса сейчас не создано");
		expect(markup).not.toContain("Часть проектов сейчас недоступна");
	});
});

it("preserves a unique legacy project's established spoken action name while keeping its visible source label", () => {
	const [card] = projectDirectoryCards(
		[
			{
				name: "Existing browser project",
				projectId: "legacy-id",
				revisionId: "r1",
				updatedAt: "2026-11-05T00:00:00.000Z",
				storageNamespace: "legacy",
			},
		],
		true,
	);
	expect(card.spokenName).toBe("Existing browser project");
	expect(card.storageLabel).toBe("На этом устройстве · обычное хранилище");
	expect(card.ownerConfirmed).toBe(true);
});
it("still qualifies every same-name copy and a unique registered copy for deliberate source selection", () => {
	const common = {
		name: "Same name",
		projectId: "same-id",
		revisionId: "r1",
		updatedAt: "2026-11-05T00:00:00.000Z",
	};
	const both = projectDirectoryCards(
		[
			{ ...common, storageNamespace: "legacy" },
			{ ...common, storageNamespace: "browser-registered" },
		],
		true,
	);
	expect(both.map((card) => card.spokenName)).toEqual([
		"Same name · На этом устройстве · обычное хранилище · Копия 1",
		"Same name · На этом устройстве · хранилище для переноса · Копия 2",
	]);
	const [registered] = projectDirectoryCards(
		[{ ...common, storageNamespace: "browser-registered" }],
		true,
	);
	expect(registered.spokenName).toBe(
		"Same name · На этом устройстве · хранилище для переноса",
	);
});

it("qualifies an empty legacy directory without declaring an unavailable or never-provisioned neighbor empty", () => {
	expect(
		projectDirectoryEmptyLabel([
			{ storageNamespace: "legacy", kind: "available" },
			{
				storageNamespace: "browser-registered",
				kind: "not-provisioned",
				history: "unknown",
			},
		]),
	).toBe("В обычном хранилище пока нет проектов");
	expect(
		projectDirectoryEmptyLabel([
			{ storageNamespace: "legacy", kind: "unavailable" },
			{ storageNamespace: "browser-registered", kind: "available" },
		]),
	).toBeUndefined();
	expect(
		projectDirectoryEmptyLabel([
			{ storageNamespace: "legacy", kind: "recovery-required" },
		]),
	).toBeUndefined();
	expect(projectDirectoryEmptyLabel([])).toBeUndefined();
	expect(projectDirectoryEmptyLabel()).toBe("Пока нет проектов");
	expect(
		projectDirectoryEmptyLabel([
			{ storageNamespace: "legacy", kind: "available" },
			{ storageNamespace: "browser-registered", kind: "available" },
		]),
	).toBe("Пока нет проектов");
});

it("a recovery-needed directory cannot become an empty-project announcement even when both stores are readable",()=>{
 expect(projectDirectoryEmptyLabel([{storageNamespace:"legacy",kind:"available"},{storageNamespace:"browser-registered",kind:"available"}],true)).toBeUndefined();
});

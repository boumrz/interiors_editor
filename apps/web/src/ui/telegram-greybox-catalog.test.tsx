import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { setEditorLanguage } from "./editor-language";
import { TelegramGreyboxCatalog } from "./telegram-greybox-catalog";

function renderCatalog(ownModels: boolean, importBusy = false, query = "") {
	return renderToStaticMarkup(
		<TelegramGreyboxCatalog
			composerOpen={false}
			importBusy={importBusy}
			onImportModel={() => undefined}
			onQueryChange={() => undefined}
			onSectionChange={() => undefined}
			onSelect={() => true}
			onToggleComposer={() => undefined}
			ownModels={ownModels}
			query={query}
		/>,
	);
}

it("displays and searches the English catalog by name while preserving the preset ID", () => {
	setEditorLanguage("en");
	try {
		const catalog = renderCatalog(false, false, "  corner sofa ");
		expect(catalog).toContain('aria-label="Search items"');
		expect(catalog).toContain('data-greybox-preset="corner-sofa"');
		expect(catalog).toContain("Corner sofa");
		expect(catalog).not.toContain("Угловой диван");
		expect(catalog.match(/data-greybox-preset=/g)).toHaveLength(1);
		expect(renderCatalog(false, false, "wall shelf")).toContain("No matching items.");
	} finally {
		setEditorLanguage("ru");
	}
});

it("reserves the Items catalog for browsing, search and category filters", () => {
	const catalog = renderCatalog(false);
	expect(catalog).toContain('aria-label="Найти предмет"');
	expect(catalog).toContain("Категории предметов");
	expect(catalog).toContain('data-greybox-preset="chair"');
	expect(catalog).not.toContain("Импортировать свой GLB");
	expect(catalog).not.toContain("Создать макетный предмет");
});

it("offers GLB import and mock item creation in My Models with a busy guard", () => {
	const catalog = renderCatalog(true);
	expect(catalog).toContain('<button type="button">Импортировать свой GLB</button>');
	expect(catalog).toContain("Создать макетный предмет");
	expect(catalog).not.toContain("data-greybox-preset=");
	expect(renderCatalog(true, true)).toContain('<button type="button" disabled="">Импортировать свой GLB</button>');
});

import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { TelegramGreyboxCatalog } from "./telegram-greybox-catalog";

function renderCatalog(ownModels: boolean, importBusy = false) {
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
			query=""
		/>,
	);
}

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
	expect(renderCatalog(true, true)).toContain('<button type="button" disabled="">Импортировать свой GLB</button>');
});

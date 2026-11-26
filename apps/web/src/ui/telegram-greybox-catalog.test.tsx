import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { setEditorLanguage } from "./editor-language";
import { Box3, Vector3 } from "three";
import { createCatalogThumbnailView, TelegramGreyboxCatalog, telegramGreyboxKindForLabel } from "./telegram-greybox-catalog";

it("uses the two-seat model only for the built-in straight sofa and offers its green finish", () => {
	expect(telegramGreyboxKindForLabel("Диван")).toBe("two-seat-sofa");
	expect(telegramGreyboxKindForLabel("Кресло")).toBe("catalog:armchair");
	expect(telegramGreyboxKindForLabel("Угловой диван")).toBe("catalog:corner-sofa");
	expect(telegramGreyboxKindForLabel("Диван Oslo")).toBeUndefined();
	const sofaCard = renderCatalog(false, false, "Диван").split('data-greybox-preset="sofa"')[1]?.split("</button>")[0];
	expect(sofaCard).toContain("#536d62");
	expect(sofaCard).toContain("2200 × 900 × 850");
});

it("keeps the legacy presentation for a wall item using a floor preset label", () => {
	expect(telegramGreyboxKindForLabel("Кресло", "wall")).toBe("sofa");
	expect(telegramGreyboxKindForLabel("Ванна", "wall")).toBe("bath");
	expect(telegramGreyboxKindForLabel("Настенный светильник", "wall")).toBe("sconce");
});

it("frames the full sofa from the open seat side at catalogue thumbnail size", () => {
	const { camera, model } = createCatalogThumbnailView({
		id: "sofa", shape: "two-seat-sofa", widthMm: 2200, heightMm: 850, depthMm: 900, color: "#536d62",
	});
	camera.updateMatrixWorld();
	model.updateMatrixWorld(true);
	const seat = model.getObjectByName("greybox:seat");
	const back = model.getObjectByName("greybox:back");
	if (!seat || !back) throw new Error("Missing sofa silhouette in the catalogue");
	const seatZ = seat.getWorldPosition(new Vector3()).z;
	expect(seatZ).toBeGreaterThan(back.getWorldPosition(new Vector3()).z);
	const downwardSlope = -camera.getWorldDirection(new Vector3()).y;
	expect(downwardSlope).toBeGreaterThan(0.32);
	expect(downwardSlope).toBeLessThan(0.4);
	const bounds = new Box3().setFromObject(model);
	const projected = new Box3();
	for (const x of [bounds.min.x, bounds.max.x]) {
		for (const y of [bounds.min.y, bounds.max.y]) {
			for (const z of [bounds.min.z, bounds.max.z]) {
				projected.expandByPoint(new Vector3(x, y, z).project(camera));
			}
		}
	}
	expect(projected.max.x - projected.min.x).toBeGreaterThan(1.45);
	expect(projected.max.x).toBeLessThan(1);
	expect(projected.min.x).toBeGreaterThan(-1);
	expect(projected.max.y).toBeLessThan(1);
	expect(projected.min.y).toBeGreaterThan(-1);
});

it("shows the open armchair seat towards the camera at thumbnail scale", () => {
	const { model } = createCatalogThumbnailView({
		id: "armchair", shape: "sofa", widthMm: 800, heightMm: 850, depthMm: 850, color: "#536d62",
	});
	const seat = model.getObjectByName("greybox:seat");
	const back = model.getObjectByName("greybox:back");
	if (!seat || !back) throw new Error("Missing armchair upholstery");
	expect(seat.getWorldPosition(new Vector3()).z).toBeGreaterThan(back.getWorldPosition(new Vector3()).z);
});

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

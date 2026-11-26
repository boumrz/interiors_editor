import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
	AmbientLight,
	Box3,
	DirectionalLight,
	Mesh,
	OrthographicCamera,
	Scene,
	Vector3,
	WebGLRenderer,
} from "three";
import { catalogFurnitureKindForPreset, furnitureFrontFacesNegativeZ } from "../adapters/renderer/catalog-models";
import type { FurnitureGreyboxKind } from "../adapters/renderer/rectangular-room-projection";
import { createThreeGreyboxItemGroup } from "../adapters/renderer/three-webgl2-room-renderer";
import {
	alphaParametricItemColorVariants,
	type ItemColorVariantId,
} from "../domain/item-color-variant";
import styles from "./AppShell.module.css";
import { copy } from "./editor-language";
import {
	greyboxFurniturePresets,
	type GreyboxFurniturePreset,
} from "./greybox-furniture";
import { disposeThreeObject3D } from "./three-resource-disposal";

const categories = {
	furniture: "Мебель",
	plumbing: "Сантехника",
	appliances: "Техника",
	lighting: "Свет",
	accessories: "Аксессуары",
};

type Category = keyof typeof categories;

const englishCategories: Record<Category, string> = {
	furniture: "Furniture",
	plumbing: "Plumbing",
	appliances: "Appliances",
	lighting: "Lighting",
	accessories: "Accessories",
};

const englishPresetNames = new Map([
	["bed", "Bed"],
	["bedside-table", "Bedside table"],
	["chair", "Chair"],
	["dresser", "Dresser"],
	["sofa", "Sofa"],
	["table", "Table"],
	["wardrobe", "Wardrobe"],
	["bath", "Bathtub"],
	["washer", "Washing machine"],
	["sconce", "Wall light"],
	["mirror", "Mirror"],
	["armchair", "Armchair"],
	["corner-sofa", "Corner sofa"],
	["single-bed", "Single bed"],
	["coffee-table", "Coffee table"],
	["desk", "Desk"],
	["open-shelf", "Open shelving"],
	["tv-stand", "TV stand"],
	["ottoman", "Ottoman"],
	["kitchen-floor-unit", "Kitchen base cabinet"],
	["kitchen-wall-unit", "Kitchen wall cabinet"],
	["toilet", "Toilet"],
	["basin", "Sink"],
	["shower", "Shower enclosure"],
	["vanity", "Bathroom vanity"],
	["fridge", "Refrigerator"],
	["dishwasher", "Dishwasher"],
	["stove", "Stove"],
	["slim-washer", "Slim washing machine"],
	["dryer", "Dryer"],
	["range-hood", "Range hood"],
	["floor-lamp", "Floor lamp"],
	["table-lamp", "Table lamp"],
	["book", "Book"],
	["vase", "Vase"],
	["mirror-light", "Mirror light"],
	["wall-spotlight", "Wall spotlight"],
	["rug", "Rug"],
	["planter", "Planter"],
	["coat-rack", "Coat rack"],
	["picture", "Framed picture"],
	["wall-shelf", "Wall shelf"],
	["full-length-mirror", "Full-length mirror"],
]);

export type TelegramGreyboxPreset = {
	readonly id: string;
	readonly label: string;
	readonly category: Category;
	readonly anchorClass: "floor" | "wall";
	readonly shape: FurnitureGreyboxKind;
	readonly widthMm: number;
	readonly depthMm: number;
	readonly heightMm: number;
	readonly color: string;
};

const furnitureKinds: Readonly<
	Record<GreyboxFurniturePreset["id"], FurnitureGreyboxKind>
> = {
	bed: "bed",
	"bedside-table": "storage",
	chair: "chair",
	dresser: "storage",
	sofa: "two-seat-sofa",
	table: "table",
	wardrobe: "storage",
};

type PresetDefaults = readonly [
	id: string,
	label: string,
	shape: FurnitureGreyboxKind,
	dimensions: readonly [widthMm: number, depthMm: number, heightMm: number],
	colorVariantId: ItemColorVariantId,
	anchorClass?: "wall",
];

// Rounded planning defaults for original forms, in width × depth × height.
const additions: Readonly<Record<Category, readonly PresetDefaults[]>> = {
	furniture: [
		["armchair", "Кресло", "sofa", [800, 850, 850], "alpha-forest"],
		[
			"corner-sofa",
			"Угловой диван",
			"corner-sofa",
			[2400, 1600, 850],
			"alpha-blue",
		],
		[
			"single-bed",
			"Односпальная кровать",
			"bed",
			[1000, 2000, 550],
			"alpha-violet",
		],
		[
			"coffee-table",
			"Журнальный столик",
			"table",
			[900, 550, 450],
			"alpha-warm-wood",
		],
		["desk", "Письменный стол", "table", [1200, 600, 750], "alpha-walnut"],
		["open-shelf", "Стеллаж", "open-shelf", [800, 350, 1800], "alpha-walnut"],
		[
			"tv-stand",
			"Тумба под телевизор",
			"storage",
			[1400, 400, 500],
			"alpha-walnut",
		],
		["ottoman", "Пуф", "generic", [450, 450, 450], "alpha-terracotta"],
		[
			"kitchen-floor-unit",
			"Напольный кухонный шкаф",
			"storage",
			[600, 600, 850],
			"alpha-warm-wood",
		],
		[
			"kitchen-wall-unit",
			"Навесной кухонный шкаф",
			"storage",
			[600, 320, 720],
			"alpha-warm-wood",
			"wall",
		],
	],
	plumbing: [
		["toilet", "Унитаз", "toilet", [400, 650, 800], "alpha-blue"],
		["basin", "Раковина", "basin", [600, 450, 180], "alpha-blue", "wall"],
		["shower", "Душевая кабина", "shower", [900, 900, 2000], "alpha-blue"],
		["vanity", "Тумба с раковиной", "vanity", [800, 480, 850], "alpha-walnut"],
	],
	appliances: [
		["fridge", "Холодильник", "fridge", [600, 650, 1850], "alpha-blue"],
		[
			"dishwasher",
			"Посудомоечная машина",
			"dishwasher",
			[600, 570, 820],
			"alpha-blue",
		],
		["stove", "Кухонная плита", "stove", [600, 600, 850], "alpha-terracotta"],
		[
			"slim-washer",
			"Узкая стиральная машина",
			"washer",
			[600, 450, 850],
			"alpha-violet",
		],
		["dryer", "Сушильная машина", "washer", [600, 650, 850], "alpha-blue"],
		[
			"range-hood",
			"Кухонная вытяжка",
			"hood",
			[600, 450, 500],
			"alpha-blue",
			"wall",
		],
	],
	lighting: [
		["floor-lamp", "Торшер", "floor-lamp", [350, 350, 1550], "alpha-warm-wood"],
		[
			"mirror-light",
			"Подсветка зеркала",
			"sconce",
			[450, 120, 80],
			"alpha-warm-wood",
			"wall",
		],
		[
			"wall-spotlight",
			"Настенный спот",
			"sconce",
			[120, 160, 150],
			"alpha-terracotta",
			"wall",
		],
	],
	accessories: [
		["rug", "Ковёр", "generic", [1600, 2300, 15], "alpha-berry"],
		["planter", "Кашпо", "planter", [350, 350, 450], "alpha-forest"],
		[
			"coat-rack",
			"Напольная вешалка",
			"coat-rack",
			[500, 500, 1700],
			"alpha-walnut",
		],
		["picture", "Картина", "mirror", [600, 30, 450], "alpha-violet", "wall"],
		[
			"wall-shelf",
			"Настенная полка",
			"wall-shelf",
			[800, 250, 100],
			"alpha-warm-wood",
			"wall",
		],
		[
			"full-length-mirror",
			"Ростовое зеркало",
			"mirror",
			[500, 45, 1500],
			"alpha-blue",
			"wall",
		],
	],
};

const categoryIds = Object.keys(categories).filter(isCategory);
const palette = new Map<ItemColorVariantId, string>(
	alphaParametricItemColorVariants.map(({ variantId, color }) => [
		variantId,
		color,
	]),
);

const presets: readonly TelegramGreyboxPreset[] = [
	...greyboxFurniturePresets.map(
		(preset): TelegramGreyboxPreset => ({
			id: preset.id,
			label: preset.label,
			category: "furniture",
			anchorClass: "floor",
			shape: furnitureKinds[preset.id],
			widthMm: Number(preset.widthMm),
			depthMm: Number(preset.depthMm),
			heightMm: Number(preset.heightMm),
			color: preset.color,
		}),
	),
	{
		id: "bath",
		label: "Ванна",
		category: "plumbing",
		anchorClass: "floor",
		shape: "bath",
		widthMm: 1700,
		depthMm: 700,
		heightMm: 520,
		color: "#416b91",
	},
	{
		id: "washer",
		label: "Стиральная машина",
		category: "appliances",
		anchorClass: "floor",
		shape: "washer",
		widthMm: 600,
		depthMm: 600,
		heightMm: 850,
		color: "#716796",
	},
	{
		id: "sconce",
		label: "Настенный светильник",
		category: "lighting",
		anchorClass: "wall",
		shape: "sconce",
		widthMm: 280,
		depthMm: 160,
		heightMm: 180,
		color: "#a76a3b",
	},
	{
		id: "mirror",
		label: "Зеркало",
		category: "accessories",
		anchorClass: "wall",
		shape: "mirror",
		widthMm: 600,
		depthMm: 45,
		heightMm: 800,
		color: "#416b91",
	},
	...categoryIds.flatMap((category) =>
		additions[category].map(
			([
				id,
				label,
				shape,
				[widthMm, depthMm, heightMm],
				variantId,
				anchorClass,
			]): TelegramGreyboxPreset => {
				const color = palette.get(variantId);
				if (!color)
					throw new Error(`Unsupported local preset color: ${variantId}`);
				return {
					id,
					label,
					category,
					anchorClass: anchorClass ?? "floor",
					shape,
					widthMm,
					depthMm,
					heightMm,
					color,
				};
			},
		),
	),
];

const interiorDecorPresets: readonly TelegramGreyboxPreset[] = [
	{ id: "table-lamp", label: "Настольная лампа", category: "lighting", anchorClass: "floor", shape: "floor-lamp", widthMm: 220, depthMm: 220, heightMm: 360, color: "#a76a3b" },
	{ id: "book", label: "Книга", category: "accessories", anchorClass: "floor", shape: "generic", widthMm: 210, depthMm: 145, heightMm: 28, color: "#416b91" },
	{ id: "vase", label: "Ваза", category: "accessories", anchorClass: "floor", shape: "planter", widthMm: 150, depthMm: 150, heightMm: 240, color: "#835a45" },
];

export function telegramGreyboxPresetForLabel(label: string) {
	return presets.find(candidate => candidate.label === label)
		?? interiorDecorPresets.find(candidate => candidate.label === label);
}

/** Shape is presentation-only. Reopen uses the same already persisted V1 label. */
export function telegramGreyboxKindForLabel(
	label: string,
	anchorClass: "floor" | "wall" = "floor",
): FurnitureGreyboxKind | undefined {
	const preset = telegramGreyboxPresetForLabel(label);
	return preset && (anchorClass === "floor" ? furnitureKindForPreset(preset) : preset.shape);
}

function furnitureKindForPreset(preset: Pick<TelegramGreyboxPreset, "id" | "shape">): FurnitureGreyboxKind {
	return catalogFurnitureKindForPreset(preset.id) ?? preset.shape;
}

export function telegramGreyboxLabelForDisplay(label: string): string {
	const preset = telegramGreyboxPresetForLabel(label);
	return preset ? greyboxDisplayName(preset) : label;
}

function greyboxDisplayName(preset: TelegramGreyboxPreset): string {
	return copy(preset.label, englishPresetNames.get(preset.id) ?? preset.label);
}

const thumbnailCache: Record<string, string> = {};
const THUMBNAIL_WIDTH = 144;
const THUMBNAIL_HEIGHT = 104;

export function createCatalogThumbnailView(
	preset: Pick<TelegramGreyboxPreset, "id" | "shape" | "widthMm" | "depthMm" | "heightMm" | "color">,
) {
	const widthM = preset.widthMm / 1000;
	const depthM = preset.depthMm / 1000;
	const heightM = preset.heightMm / 1000;
	const kind = furnitureKindForPreset(preset);
	const isTwoSeatSofa = kind === "two-seat-sofa";
	const isUpdatedPreset = kind.startsWith("catalog:");
	const extent = Math.max(widthM, depthM, heightM) * (isTwoSeatSofa ? 0.46 : 0.85);
	const horizontal = (extent * THUMBNAIL_WIDTH) / THUMBNAIL_HEIGHT;
	const camera = new OrthographicCamera(
		-horizontal,
		horizontal,
		extent,
		-extent,
		0.01,
		20,
	);
	const elevation = kind === "catalog:rug" ? 3.4 : isUpdatedPreset ? 2.35 : 1.4;
	camera.position.set(1.9, heightM / 2 + elevation, 3.2);
	camera.lookAt(0, heightM / 2, 0);
	const model = createThreeGreyboxItemGroup({
		centerXM: 0,
		centerYM: heightM / 2,
		centerZM: 0,
		widthM,
		depthM,
		heightM,
		material: { colorHex: preset.color, furnitureKind: kind },
	});
	if (isTwoSeatSofa || (isUpdatedPreset && furnitureFrontFacesNegativeZ(kind))) model.rotation.y = Math.PI;
	if (isUpdatedPreset) {
		camera.updateMatrixWorld();
		model.updateMatrixWorld(true);
		const bounds = new Box3();
		const point = new Vector3();
		model.traverse((mesh) => {
			if (!(mesh instanceof Mesh)) return;
			const positions = mesh.geometry.getAttribute("position");
			for (let index = 0; index < positions.count; index += 1) {
				point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
				bounds.expandByPoint(point);
			}
		});
		const size = bounds.getSize(new Vector3());
		const centre = bounds.getCenter(new Vector3());
		const aspect = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;
		const halfHeight = Math.max(size.y, size.x / aspect) * 0.57;
		camera.left = centre.x - halfHeight * aspect;
		camera.right = centre.x + halfHeight * aspect;
		camera.top = centre.y + halfHeight;
		camera.bottom = centre.y - halfHeight;
		camera.updateProjectionMatrix();
	}
	return { camera, model };
}

function createThumbnailCapture() {
	const canvas = document.createElement("canvas");
	let context: WebGL2RenderingContext | null = null;
	let renderer: WebGLRenderer;
	try {
		context = canvas.getContext("webgl2", {
			alpha: true,
			powerPreference: "low-power",
			preserveDrawingBuffer: true,
		});
		if (!context) return;
		renderer = new WebGLRenderer({ alpha: true, canvas, context });
	} catch {
		context?.getExtension("WEBGL_lose_context")?.loseContext();
		return;
	}
	renderer.setSize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, false);
	const scene = new Scene();
	scene.add(new AmbientLight(0xffffff, 2));
	const light = new DirectionalLight(0xffffff, 2.5);
	light.position.set(-2, 4, 3);
	scene.add(light);
	return {
		capture(preset: TelegramGreyboxPreset) {
			const { camera, model } = createCatalogThumbnailView(preset);
			scene.add(model);
			try {
				renderer.render(scene, camera);
				return canvas.toDataURL();
			} finally {
				scene.remove(model);
				disposeThreeObject3D(model);
			}
		},
		dispose() {
			renderer.dispose();
			renderer.forceContextLoss();
		},
	};
}

function useThumbnails(
	gridRef: RefObject<HTMLDivElement | null>,
	matchingPresets: readonly TelegramGreyboxPreset[],
) {
	const [thumbnails, setThumbnails] = useState<
		Readonly<Record<string, string>>
	>(() => ({ ...thumbnailCache }));
	useEffect(() => {
		const grid = gridRef.current;
		const memory: unknown = Reflect.get(navigator, "deviceMemory");
		const cards = matchingPresets.filter(
			(preset) => !thumbnailCache[preset.id],
		);
		if (
			!grid ||
			cards.length === 0 ||
			typeof IntersectionObserver === "undefined" ||
			(typeof memory === "number" && memory < 2)
		)
			return;
		const presetById = new Map(cards.map((preset) => [preset.id, preset]));
		const pending = new Set<TelegramGreyboxPreset>();
		let capture: ReturnType<typeof createThumbnailCapture>;
		let frame: number | undefined;
		let idleTimer: number | undefined;
		let unavailable = false;
		const releaseCapture = () => {
			capture?.dispose();
			capture = undefined;
		};
		const renderNext = () => {
			frame = undefined;
			const preset = pending.values().next().value;
			if (!preset) {
				idleTimer = window.setTimeout(releaseCapture, 150);
				return;
			}
			pending.delete(preset);
			capture ??= createThumbnailCapture();
			if (!capture) {
				unavailable = true;
				return;
			}
			try {
				const thumbnail = capture.capture(preset);
				thumbnailCache[preset.id] = thumbnail;
				setThumbnails((current) => ({ ...current, [preset.id]: thumbnail }));
			} catch {
				unavailable = true;
				releaseCapture();
				return;
			}
			frame = requestAnimationFrame(renderNext);
		};
		const observer = new IntersectionObserver(
			(entries) => {
				if (unavailable) return;
				for (const entry of entries) {
					const presetId = entry.target.getAttribute("data-greybox-preset");
					const preset = presetId ? presetById.get(presetId) : undefined;
					if (!preset || thumbnailCache[preset.id]) continue;
					if (entry.isIntersecting) pending.add(preset);
					else pending.delete(preset);
				}
				if (pending.size > 0 && frame === undefined) {
					window.clearTimeout(idleTimer);
					frame = requestAnimationFrame(renderNext);
				}
			},
			{ root: grid, rootMargin: "100px 0px" },
		);
		for (const card of grid.querySelectorAll("[data-greybox-preset]"))
			observer.observe(card);
		return () => {
			observer.disconnect();
			if (frame !== undefined) cancelAnimationFrame(frame);
			window.clearTimeout(idleTimer);
			releaseCapture();
		};
	}, [gridRef, matchingPresets]);
	return thumbnails;
}

type TelegramGreyboxCatalogProps = {
	readonly interiorDecor?: boolean;
	readonly onSelect: (preset: TelegramGreyboxPreset) => boolean;
	readonly onImportModel: () => void;
	readonly ownModels: boolean;
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
	readonly onSectionChange: (ownModels: boolean) => void;
	readonly importBusy: boolean;
	readonly onToggleComposer: () => void;
	readonly composerOpen: boolean;
};

export function TelegramGreyboxCatalog({
	onSelect,
	onImportModel,
	ownModels,
	query,
	onQueryChange,
	onSectionChange,
	importBusy,
	onToggleComposer,
	composerOpen,
	interiorDecor = false,
}: TelegramGreyboxCatalogProps) {
	const [category, setCategory] = useState<Category | "all">("all");
	const [placementUnavailable, setPlacementUnavailable] = useState(false);
	const gridRef = useRef<HTMLDivElement>(null);
	const matchingPresets = useMemo(() => {
		if (ownModels) return [];
		const search = catalogSearchText(query.trim());
		return (interiorDecor ? [...presets, ...interiorDecorPresets] : presets).filter(
			(preset) =>
				preset.anchorClass === "floor" &&
				(category === "all" || category === preset.category) &&
				catalogSearchText(
					[
						preset.label,
						englishPresetNames.get(preset.id),
						categories[preset.category],
						englishCategories[preset.category],
					].join(" "),
				).includes(search),
		);
	}, [category, query, ownModels, interiorDecor]);
	const thumbnails = useThumbnails(gridRef, matchingPresets);
	return (
		<>
			<div className={styles.tmaCatalogControls}>
				<div
					className={styles.tmaCatalogSections}
					role="tablist"
					aria-label={copy("Разделы каталога", "Catalog sections")}
				>
					{(["presets", "models"] as const).map((section) => {
						const isOwn = section === "models";
						const selected = isOwn === ownModels;
						return (
							<button
								aria-controls={`catalog-panel-${section}`}
								aria-selected={selected}
								id={`catalog-tab-${section}`}
								key={section}
								onClick={() => {
									if (!selected) onSectionChange(isOwn);
								}}
								onKeyDown={(event) => {
									let target: boolean;
									if (event.key === "ArrowLeft" || event.key === "ArrowRight")
										target = !isOwn;
									else if (event.key === "Home") target = false;
									else if (event.key === "End") target = true;
									else return;
									event.preventDefault();
									document
										.getElementById(
											target ? "catalog-tab-models" : "catalog-tab-presets",
										)
										?.focus();
									if (target !== ownModels) onSectionChange(target);
								}}
								role="tab"
								tabIndex={selected ? 0 : -1}
								type="button"
							>
								{isOwn
									? copy("Мои модели", "My models")
									: copy("Предметы", "Items")}
							</button>
						);
					})}
				</div>
				<div className={styles.tmaGreyboxSearch}>
					<input
						aria-label={copy("Найти предмет", "Search items")}
						placeholder={copy("Найти предмет", "Search items")}
						value={query}
						onChange={(event) => {
							onQueryChange(event.target.value);
							setPlacementUnavailable(false);
						}}
					/>
					{query && (
						<button
							type="button"
							onClick={() => {
								onQueryChange("");
								setCategory("all");
								setPlacementUnavailable(false);
							}}
						>
							{copy("Очистить поиск", "Clear search")}
						</button>
					)}
				</div>
				{ownModels && (
					<div className={styles.tmaGreyboxActions}>
						<button type="button" onClick={onImportModel} disabled={importBusy}>
							{copy("Импортировать свой GLB", "Import a GLB")}
						</button>
						<button
							type="button"
							aria-expanded={composerOpen}
							onClick={onToggleComposer}
						>
							{composerOpen
								? copy("Скрыть параметры", "Hide settings")
								: copy("Создать макетный предмет", "Create a placeholder item")}
						</button>
					</div>
				)}
			</div>
			<div
				className={styles.tmaGreyboxCatalog}
				role="tabpanel"
				id="catalog-panel-presets"
				aria-labelledby="catalog-tab-presets"
				hidden={ownModels}
			>
				<fieldset className={styles.catalogCategoryTabs}>
					<legend className={styles.visuallyHidden}>
						{copy("Категории предметов", "Item categories")}
					</legend>
					<button
						type="button"
						aria-pressed={category === "all"}
						onClick={() => setCategory("all")}
					>
						{copy("Все", "All")}
					</button>
					{categoryIds.map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={category === value}
							onClick={() => {
								setCategory(value);
							}}
						>
							{copy(categories[value], englishCategories[value])}
						</button>
					))}
				</fieldset>
				{placementUnavailable && (
					<p role="alert" className={styles.fieldError}>
						{copy(
							"Сейчас разместить предмет нельзя. Попробуйте снова после сохранения.",
							"The item cannot be placed yet. Try again after saving.",
						)}
					</p>
				)}
				<div className={styles.catalogGrid} ref={gridRef}>
					{matchingPresets.map((preset) => (
						<button
							className={styles.catalogCard}
							data-greybox-preset={preset.id}
							type="button"
							key={preset.id}
							onClick={() => setPlacementUnavailable(!onSelect(preset))}
						>
							{thumbnails[preset.id] ? (
								<img
									alt=""
									className={styles.tmaGreyboxThumbnail}
									src={thumbnails[preset.id]}
								/>
							) : (
								<span
									className={styles.tmaGreyboxFootprint}
									aria-hidden="true"
									style={{
										backgroundColor: preset.color,
										aspectRatio: `${preset.widthMm} / ${preset.depthMm}`,
									}}
								/>
							)}
							<div className={styles.catalogCardDetails}>
								<strong>{greyboxDisplayName(preset)}</strong>
								<small>
									{preset.widthMm} × {preset.depthMm} × {preset.heightMm}
									{copy(" мм", " mm")}
								</small>
							</div>
						</button>
					))}
					{matchingPresets.length === 0 && (
						<p role="status">
							{copy("Подходящих предметов нет.", "No matching items.")}
						</p>
					)}
				</div>
			</div>
		</>
	);
}

function isCategory(value: string): value is Category {
	return Object.hasOwn(categories, value);
}

function catalogSearchText(value: string): string {
	return value.toLocaleLowerCase("ru").replaceAll("ё", "е");
}

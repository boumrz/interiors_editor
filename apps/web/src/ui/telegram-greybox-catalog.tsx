import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
	AmbientLight,
	DirectionalLight,
	OrthographicCamera,
	Scene,
	WebGLRenderer,
} from "three";
import type { FurnitureGreyboxKind } from "../adapters/renderer/rectangular-room-projection";
import { createThreeGreyboxItemGroup } from "../adapters/renderer/three-webgl2-room-renderer";
import {
	alphaParametricItemColorVariants,
	type ItemColorVariantId,
} from "../domain/item-color-variant";
import styles from "./AppShell.module.css";
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
	sofa: "sofa",
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

/** Shape is presentation-only. Reopen uses the same already persisted V1 label. */
export function telegramGreyboxKindForLabel(
	label: string,
): FurnitureGreyboxKind | undefined {
	return presets.find((preset) => preset.label === label)?.shape;
}

const thumbnailCache: Record<string, string> = {};
const THUMBNAIL_WIDTH = 144;
const THUMBNAIL_HEIGHT = 104;

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
			const widthM = preset.widthMm / 1000;
			const depthM = preset.depthMm / 1000;
			const heightM = preset.heightMm / 1000;
			const extent = Math.max(widthM, depthM, heightM) * 0.85;
			const horizontal = (extent * THUMBNAIL_WIDTH) / THUMBNAIL_HEIGHT;
			const camera = new OrthographicCamera(
				-horizontal,
				horizontal,
				extent,
				-extent,
				0.01,
				20,
			);
			camera.position.set(1.9, heightM / 2 + 1.4, 3.2);
			camera.lookAt(0, heightM / 2, 0);
			const model = createThreeGreyboxItemGroup({
				centerXM: 0,
				centerYM: heightM / 2,
				centerZM: 0,
				widthM,
				depthM,
				heightM,
				material: { colorHex: preset.color, furnitureKind: preset.shape },
			});
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
}: TelegramGreyboxCatalogProps) {
	const [category, setCategory] = useState<Category | "all">("all");
	const [placementUnavailable, setPlacementUnavailable] = useState(false);
	const gridRef = useRef<HTMLDivElement>(null);
	const matchingPresets = useMemo(() => {
		if (ownModels) return [];
		const search = catalogSearchText(query.trim());
		return presets.filter(
			(preset) =>
				preset.anchorClass === "floor" &&
				(category === "all" || category === preset.category) &&
				catalogSearchText(
					`${preset.label} ${categories[preset.category]}`,
				).includes(search),
		);
	}, [category, query, ownModels]);
	const thumbnails = useThumbnails(gridRef, matchingPresets);
	return (
		<>
			<div className={styles.tmaCatalogControls}>
				<div
					className={styles.tmaCatalogSections}
					role="tablist"
					aria-label="Разделы каталога"
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
								{isOwn ? "Мои модели" : "Предметы"}
							</button>
						);
					})}
				</div>
				<div className={styles.tmaGreyboxSearch}>
					<input
						aria-label="Найти предмет"
						placeholder="Найти предмет"
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
							Очистить поиск
						</button>
					)}
				</div>
				<div className={styles.tmaGreyboxActions}>
					<button type="button" onClick={onImportModel} disabled={importBusy}>
						Импортировать свой GLB
					</button>
					{ownModels && (
						<button
							type="button"
							aria-expanded={composerOpen}
							onClick={onToggleComposer}
						>
							{composerOpen ? "Скрыть параметры" : "Создать макетный предмет"}
						</button>
					)}
				</div>
			</div>
			<div
				className={styles.tmaGreyboxCatalog}
				role="tabpanel"
				id="catalog-panel-presets"
				aria-labelledby="catalog-tab-presets"
				hidden={ownModels}
			>
				<fieldset className={styles.catalogCategoryTabs}>
					<legend className={styles.visuallyHidden}>Категории предметов</legend>
					<button
						type="button"
						aria-pressed={category === "all"}
						onClick={() => setCategory("all")}
					>
						Все
					</button>
					{Object.entries(categories).map(([value, label]) => (
						<button
							key={value}
							type="button"
							aria-pressed={category === value}
							onClick={() => {
								if (isCategory(value)) setCategory(value);
							}}
						>
							{label}
						</button>
					))}
				</fieldset>
				{placementUnavailable && (
					<p role="alert" className={styles.fieldError}>
						Сейчас разместить предмет нельзя. Попробуйте снова после сохранения.
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
								<strong>{preset.label}</strong>
								<small>
									{preset.widthMm} × {preset.depthMm} × {preset.heightMm} мм
								</small>
							</div>
						</button>
					))}
					{matchingPresets.length === 0 && (
						<p role="status">Подходящих предметов нет.</p>
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

import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";

import type { RectangularRoomWebGlScene } from "../adapters/renderer/rectangular-room-projection";
import {
	customGlbPresentationFor,
	hasUndurableThreeDimensionalItemTransform,
	isThreeDimensionalRotationActive,
	rendererDiagnosticsCopy,
	RoomScene3d,
} from "./RoomScene3d";

const scene: RectangularRoomWebGlScene = {
	cameraBounds: { centerXM: 2.05, centerZM: 1.55, depthM: 3.1, widthM: 4.1 },
	dimensions: { depthMm: 3000, heightMm: 2600, widthMm: 4000 },
	floors: [
		{
			centerXM: 2.05,
			centerYM: 0,
			centerZM: 1.55,
			depthM: 3,
			heightM: 0.04,
			widthM: 4,
		},
	],
	items: [],
	walls: [],
};

describe("RoomScene3d", () => {
	it("provides the scene material controls for a selected wall item", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				scene={{
					...scene, items: [{
						assetAnchor: "wall", assetInstanceId: "wall-sconce",
						centerXM: 1, centerYM: 1.6, centerZM: 1,
						depthM: 0.2, heightM: 0.2, widthM: 0.3,
					}],
				}}
				selectedItemId="wall-sconce"
				selectedItemControls={<button type="button">Цвет подсветки</button>}
			/>,
		);
		expect(markup).toContain("Цвет подсветки");
		expect(markup).not.toContain('data-testid="three-dimensional-rotation-gizmo"');
	});

	it("restores a chosen placement pose when opening the 3D draft", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				scene={scene}
				itemPlacementDraft={{ color: "#123456", depthMm: 500, heightMm: 700, label: "Стул", widthMm: 500 }}
				initialItemPlacementPoint={{ xM: 1.5, zM: 1.5 }}
				assessItemPlacement={() => ({ kind: "valid" })}
			/>,
		);
		expect(markup).toContain('data-x-m="1.500"');
		expect(markup).toContain('data-placement-valid="true"');
	});

	it("marks a colliding draft as unavailable in 3D and explains the obstruction", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				plainLabels
				scene={scene}
				itemPlacementDraft={{ color: "#123456", depthMm: 500, heightMm: 700, label: "Стул", widthMm: 500 }}
				initialItemPlacementPoint={{ xM: 1.5, zM: 1.5 }}
				assessItemPlacement={() => ({ kind: "invalid", reasonCode: "ITEM_COLLISION" })}
			/>,
		);
		expect(markup).toContain('data-placement-valid="false"');
		expect(markup).toContain('data-placement-state="choose-another-point"');
		expect(markup).toContain("Предмет пересекается с другим предметом. Выберите другое место.");
	});

	it("reports a verified GLB as visible only after its local runtime has decoded", () => {
		expect(
			customGlbPresentationFor({
				resourceState: "ready",
				runtimeState: "loading",
			}),
		).toBe("loading");
		expect(
			customGlbPresentationFor({
				resourceState: "ready",
				runtimeState: "ready",
			}),
		).toBe("rendered");
		expect(
			customGlbPresentationFor({
				resourceState: "ready",
				runtimeState: "unavailable",
			}),
		).toBe("unavailable");
		expect(customGlbPresentationFor({ resourceState: "unavailable" })).toBe(
			"unavailable",
		);
	});

	it("marks every uncommitted 3D item interaction as unsafe for a PWA update", () => {
		expect(
			hasUndurableThreeDimensionalItemTransform({
				hasItemPreview: false,
				hasPendingItemPreview: false,
				hasRotation: false,
				isConfirmingItemTransform: false,
			}),
		).toBe(false);

		for (const transientState of [
			{ hasItemPreview: true },
			{ hasPendingItemPreview: true },
			{ hasRotation: true },
			{ isConfirmingItemTransform: true },
		]) {
			expect(
				hasUndurableThreeDimensionalItemTransform({
					hasItemPreview: false,
					hasPendingItemPreview: false,
					hasRotation: false,
					isConfirmingItemTransform: false,
					...transientState,
				}),
			).toBe(true);
		}
	});

	it("keeps the rotation ring quiet when a placement preview has no durable item identity", () => {
		expect(isThreeDimensionalRotationActive(undefined, undefined)).toBe(false);
		expect(isThreeDimensionalRotationActive("chair-1", undefined)).toBe(false);
		expect(isThreeDimensionalRotationActive(undefined, "chair-1")).toBe(false);
		expect(isThreeDimensionalRotationActive("chair-1", "chair-1")).toBe(
			true,
		);
	});

	it("exposes the Auto cutaway control and its current observable state in the 3D editor", () => {
		const markup = renderToStaticMarkup(<RoomScene3d scene={scene} />);

		expect(markup).toContain('data-testid="three-dimensional-view-controls"');
		expect(markup).toContain('data-testid="three-dimensional-camera-deck"');
		expect(markup).toContain('aria-label="Управление видом 3D"');
		expect(markup).toContain("Режим стен 3D");
		expect(markup).toContain('aria-label="Масштаб 3D"');
		expect(markup).toContain('data-testid="three-dimensional-auto-cutaway-icon"');
		expect(markup).toContain('data-testid="three-dimensional-all-walls-icon"');
		expect(markup).not.toContain('data-testid="three-dimensional-orientation-axis"');
		expect(markup).not.toContain("+Z");
		expect(markup).not.toContain('aria-label="Вернуть обзор 3D"');
		expect(markup).toContain("Авто");
		expect(markup).toContain("Все стены");
		expect(markup).toContain('data-testid="three-dimensional-cutaway"');
		expect(markup).toContain("Авто: ближние внешние стены скрываются");
		expect(markup).not.toContain('data-testid="three-dimensional-cutaway-notice"');
		expect(markup).not.toContain("Только для обзора");
		expect(markup).not.toContain('data-testid="three-dimensional-gesture-hint"');
		for (const id of [
			"three-dimensional-cutaway",
			"three-dimensional-renderer-diagnostics",
		]) {
			const diagnostic = new RegExp(
				`<output[^>]*data-testid="${id}"[^>]*>`,
			).exec(markup)?.[0];
			expect(diagnostic).toContain('hidden=""');
		}
	});

	it("keeps placement identity and explicit actions without a positive instruction", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				itemPlacementDraft={{
					color: "#123456",
					depthMm: 500,
					heightMm: 700,
					label: "Мой стул",
					widthMm: 500,
				}}
				scene={scene}
			/>,
		);

		expect(markup).toContain('data-placement-state="choose-point"');
		expect(markup).toContain("Мой стул");
		expect(markup).toContain('aria-label="Отменить размещение предмета"');
		expect(markup).toContain('aria-label="Подтвердить размещение предмета"');
		expect(markup).not.toContain('data-testid="three-dimensional-item-placement-status"');
		expect(markup).not.toContain("Коснитесь пола");
	});

	it.each([true, false])("uses the shared plain placement actions only when requested (%s)", plainLabels => {
		const markup = renderToStaticMarkup(<RoomScene3d
			plainLabels={plainLabels}
			itemPlacementDraft={{ color: "#123456", depthMm: 500, heightMm: 700, label: "Стул", widthMm: 500 }}
			scene={scene}
		/>);
		expect(markup).toContain(`>${plainLabels ? "Подтвердить" : "Поставить"}</button>`);
		expect(markup).toContain(`>${plainLabels ? "Отменить" : "Отмена"}</button>`);
	});

	it("offers the shared draft angle and rotation steps before choosing a floor point", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				itemPlacementDraft={{
					color: "#123456",
					depthMm: 500,
					heightMm: 700,
					label: "Мой стул",
					widthMm: 500,
					yawRadians: Math.PI / 2,
				}}
				onItemPlacementYawChange={() => undefined}
				scene={scene}
			/>,
		);

		expect(markup).toContain('data-testid="three-dimensional-placement-rotation-angle"');
		expect(markup).toContain("90°");
		expect(markup).toContain('aria-label="Повернуть предмет на 45° против часовой стрелки"');
		expect(markup).toContain('aria-label="Повернуть предмет на 45° по часовой стрелке"');
		expect(markup).not.toContain('data-testid="three-dimensional-rotation-dome"');
	});

	it("offers a numeric exact angle in the 3D placement controls", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				exactFloorYaw
				itemPlacementDraft={{ color: "#123456", depthMm: 500, heightMm: 700, label: "Стул", widthMm: 500, yawRadians: 37.5 * Math.PI / 180 }}
				onItemPlacementYawChange={() => undefined}
				scene={scene}
			/>,
		);
		expect(markup).toContain('inputMode="decimal"');
		expect(markup).toMatch(/value="37[.,]5"/);
	});
	it("uses the same Russian item-count form as the plan for a furnished scene", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				scene={{
					...scene,
					items: [
						{
							assetInstanceId: "chair-1",
							centerXM: 0.8,
							centerYM: 0.4,
							centerZM: 0.8,
							depthM: 0.6,
							heightM: 0.8,
							widthM: 0.6,
						},
						{
							assetInstanceId: "chair-2",
							centerXM: 2,
							centerYM: 0.4,
							centerZM: 1.2,
							depthM: 0.6,
							heightM: 0.8,
							widthM: 0.6,
						},
						{
							assetInstanceId: "sideboard-1",
							centerXM: 3.2,
							centerYM: 0.45,
							centerZM: 2.2,
							depthM: 0.5,
							heightM: 0.9,
							widthM: 1.2,
						},
					],
				}}
			/>,
		);

		expect(markup).toContain("3 предмета в плане");
		expect(markup).toContain('<output hidden="">3 предмета в плане</output>');
	});

	it("describes the transient reduced renderer tier without claiming simplified Project data", () => {
		expect(
			rendererDiagnosticsCopy({ kind: "ready", qualityTier: "reduced" }),
		).toBe(
			"Диагностика 3D: WebGL2 · облегчённое качество; геометрия и данные проекта не изменены.",
		);
	});

	it("keeps the touch canvas and cutaway controls operable without mutating its scene input", () => {
		const immutableScene: RectangularRoomWebGlScene = Object.freeze({
			...scene,
			floors: Object.freeze(
				scene.floors.map((floor) => Object.freeze({ ...floor })),
			),
			items: Object.freeze(
				scene.items.map((item) => Object.freeze({ ...item })),
			),
			walls: Object.freeze(
				scene.walls.map((wall) => Object.freeze({ ...wall })),
			),
		});
		const before = JSON.stringify(immutableScene);

		const markup = renderToStaticMarkup(<RoomScene3d scene={immutableScene} />);
		const auto = /<button[^>]*>.*?Авто.*?<\/button>/.exec(markup)?.[0];
		const showAll = /<button[^>]*>.*?Все стены.*?<\/button>/.exec(markup)?.[0];

		expect(markup).toContain('style="touch-action:none"');
		expect(auto).toContain('aria-pressed="true"');
		expect(auto).toContain('aria-label="Авто cutaway"');
		expect(auto).toContain("min-height:44px");
		expect(auto).toContain("min-inline-size:44px");
		expect(auto).toContain('type="button"');
		expect(auto).not.toContain("disabled");
		expect(showAll).toContain('aria-pressed="false"');
		expect(showAll).toContain('aria-label="Показать все стены"');
		expect(showAll).toContain("min-height:44px");
		expect(showAll).toContain("min-inline-size:44px");
		expect(showAll).toContain('type="button"');
		expect(showAll).not.toContain("disabled");
		expect(JSON.stringify(immutableScene)).toBe(before);
	});

	it("keeps the precise fallback visible while an admitted GLB is decoded for the room renderer", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				customGlbResourceStates={{ "chair-definition": "ready" }}
				scene={{
					...scene,
					items: [
						{
							assetDefinitionId: "chair-definition",
							assetInstanceId: "chair-instance",
							centerXM: 1,
							centerYM: 0.5,
							centerZM: 1,
							depthM: 1,
							heightM: 1,
							widthM: 1,
						},
					],
				}}
			/>,
		);

		expect(markup).toContain(
			'data-testid="three-dimensional-custom-glb-status"',
		);
		expect(markup).toContain("loading:1");
		expect(markup).not.toContain("Проверяем модель для 3D");
		expect(markup).not.toContain("Проверяем локальную готовность модели");
	});

	it("keeps the raw 3D greybox available while a custom GLB is still being verified", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				customGlbResourceStates={{ "chair-definition": "loading" }}
				scene={{
					...scene,
					items: [
						{
							assetDefinitionId: "chair-definition",
							assetInstanceId: "chair-instance",
							centerXM: 1,
							centerYM: 0.5,
							centerZM: 1,
							depthM: 1,
							heightM: 1,
							widthM: 1,
						},
					],
				}}
			/>,
		);

		expect(markup).toContain("loading:1");
		expect(markup).not.toContain("Проверяем модель для 3D");
		expect(markup).not.toContain("габаритный контур остаётся");
	});

	it("shows an explicit unavailable state only after the parent verification has completed unsuccessfully", () => {
		const markup = renderToStaticMarkup(
			<RoomScene3d
				customGlbResourceStates={{ "chair-definition": "unavailable" }}
				scene={{
					...scene,
					items: [
						{
							assetDefinitionId: "chair-definition",
							assetInstanceId: "chair-instance",
							centerXM: 1,
							centerYM: 0.5,
							centerZM: 1,
							depthM: 1,
							heightM: 1,
							widthM: 1,
						},
					],
				}}
			/>,
		);

		expect(markup).toContain("unavailable:1");
		expect(markup).toContain("Модель не открылась в 3D");
		expect(markup).toContain("Повторить подготовку модели");
		expect(markup).not.toContain(
			"Подготавливаем пользовательскую модель для 3D-сцены.",
		);
	});

	it("keeps 3D inspection free of Room selection controls", () => {
		const markup = renderToStaticMarkup(<RoomScene3d scene={scene} />);

		expect(markup).not.toContain("Выбрать помещение в 3D");
		expect(markup).not.toContain("Помещение 3D");
		expect(markup).not.toContain("Снять выбор помещения");
		expect(markup).not.toContain("three-dimensional-room-selection");
		expect(markup).not.toContain("Прогулка");
		expect(markup).not.toContain("Войти в прогулку");
	});
});

import { expect, it } from "@rstest/core";
import {
	Box3,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	Raycaster,
	Vector3,
} from "three";
import { resolveOrthogonalPlanFaces } from "../../domain/derived-orthogonal-plan-faces";
import { createInitialProject } from "../../domain/initial-project";
import { configureRectangularRoom } from "../../domain/rectangular-room";
import { createFloorItemWallSnap } from "../../ui/floor-item-wall-snap";
import { itemWallDistancesFor } from "../../ui/item-wall-distances";
import { alphaParametricItemColorVariants } from "../../domain/item-color-variant";
import {
	createCatalogThumbnailView,
	telegramGreyboxKindForLabel,
} from "../../ui/telegram-greybox-catalog";
import { furnitureFrontFacesNegativeZ } from "./catalog-models";
import { catalogProfileGeometry } from "./catalog-profile-geometry";
import type { SceneBox } from "./rectangular-room-projection";
import {
	createThreeGreyboxItemGroup,
	pickThreeSceneItem,
} from "./three-webgl2-room-renderer";
import { pickProceduralSceneItem } from "./webgl2-item-picking";
import { drawFurniture } from "./webgl2-room-renderer";
import { furnitureGreyboxPartsFor } from "./webgl2-room-renderer-shared";

const catalog = [
	["Кресло", 800, 850, 850],
	["Стул", 500, 500, 900],
	["Угловой диван", 2400, 1600, 850],
	["Пуф", 450, 450, 450],
	["Журнальный столик", 900, 550, 450],
	["Стол", 1200, 700, 750],
	["Письменный стол", 1200, 600, 750],
	["Кровать", 1600, 2000, 500],
	["Односпальная кровать", 1000, 2000, 550],
	["Тумбочка", 500, 400, 600],
	["Комод", 1200, 500, 900],
	["Шкаф", 1200, 600, 2200],
	["Стеллаж", 800, 350, 1800],
	["Тумба под телевизор", 1400, 400, 500],
	["Напольный кухонный шкаф", 600, 600, 850],
	["Стиральная машина", 600, 600, 850],
	["Узкая стиральная машина", 600, 450, 850],
	["Сушильная машина", 600, 650, 850],
	["Холодильник", 600, 650, 1850],
	["Посудомоечная машина", 600, 570, 820],
	["Кухонная плита", 600, 600, 850],
	["Ванна", 1700, 700, 520],
	["Унитаз", 400, 650, 800],
	["Душевая кабина", 900, 900, 2000],
	["Тумба с раковиной", 800, 480, 850],
	["Торшер", 350, 350, 1550],
	["Ковёр", 1600, 2300, 15],
	["Кашпо", 350, 350, 450],
	["Напольная вешалка", 500, 500, 1700],
] as const;

function modelItem(
	label: string,
	widthM: number,
	depthM: number,
	heightM: number,
	colorHex: string,
): SceneBox {
	const furnitureKind = telegramGreyboxKindForLabel(label);
	if (!furnitureKind) throw new Error(`Missing catalog entry: ${label}`);
	return {
		widthM,
		depthM,
		heightM,
		centerXM: 0,
		centerYM: heightM / 2,
		centerZM: 0,
		material: { furnitureKind, colorHex },
	};
}

it.each(catalog)(
	"%s preserves its envelope and supports all seven finishes",
	(label, width, depth, height) => {
		for (const [xScale, yScale, zScale, yaw] of [
			[1, 1, 1, 0],
			[0.35, 1.15, 0.72, Math.PI / 2],
		] as const) {
			const item = modelItem(
				label,
				(width * xScale) / 1000,
				(depth * zScale) / 1000,
				(height * yScale) / 1000,
				"#235671",
			);
			const pose = { ...item, centerXM: 2.1, centerZM: 3.9, yawRadians: yaw };
			const group = createThreeGreyboxItemGroup(pose);
			const { min, max } = new Box3().setFromObject(group, true);
			const projectedWidth = yaw === 0 ? item.widthM : item.depthM;
			const projectedDepth = yaw === 0 ? item.depthM : item.widthM;
			expect(min.toArray()).toEqual([
				expect.closeTo(pose.centerXM - projectedWidth / 2, 6),
				expect.closeTo(0, 6),
				expect.closeTo(pose.centerZM - projectedDepth / 2, 6),
			]);
			expect(max.toArray()).toEqual([
				expect.closeTo(pose.centerXM + projectedWidth / 2, 6),
				expect.closeTo(item.heightM, 6),
				expect.closeTo(pose.centerZM + projectedDepth / 2, 6),
			]);
			const parts = furnitureGreyboxPartsFor(pose, true);
			expect(parts.length).toBeGreaterThan(1);
			expect(parts.length).toBe(group.children.length);
			for (const [{ box, edgeRadiusM }, mesh] of parts.map(
				(part, index) => [part, group.children[index]] as const,
			)) {
				const thickness = Math.min(box.widthM, box.heightM, box.depthM);
				expect(thickness).toBeGreaterThan(0);
				expect(edgeRadiusM ?? 0).toBeLessThanOrEqual(thickness / 2);
				expect(mesh?.getWorldPosition(new Vector3()).toArray()).toEqual([
					expect.closeTo(box.centerXM, 6),
					expect.closeTo(box.centerYM, 6),
					expect.closeTo(box.centerZM, 6),
				]);
			}
			expect(furnitureGreyboxPartsFor(item, false)).toHaveLength(1);
		}

		const colorsFor = (color: string) => {
			const group = createThreeGreyboxItemGroup(
				modelItem(label, width / 1000, depth / 1000, height / 1000, color),
			);
			return group.children.flatMap((child) =>
				child instanceof Mesh && child.material instanceof MeshStandardMaterial
					? [`#${child.material.color.getHexString()}`]
					: [],
			);
		};
		const legacy = colorsFor("#235671");
		const variants = alphaParametricItemColorVariants.map(({ color }) => {
			const materials = colorsFor(color);
			expect(materials).toContain(color);
			expect(materials).toHaveLength(legacy.length);
			return materials;
		});
		expect(legacy).toContain("#235671");
		const fixed = legacy.filter((color, index) =>
			variants.every((colors) => colors[index] === color),
		);
		if (label === "Ковёр" || label === "Стеллаж") {
			expect(fixed).toHaveLength(0);
		} else {
			expect(fixed.length).toBeGreaterThan(0);
		}
	},
);

it("keeps the armchair seat and back in the chosen trim and leaves the frame above the floor open", () => {
	const item = modelItem("Кресло", 0.8, 0.85, 0.85, "#416b91");
	const group = createThreeGreyboxItemGroup({
		...item,
		centerXM: 1,
		centerZM: 2,
		yawRadians: Math.PI / 2,
	});
	const seat = group.getObjectByName("greybox:seat");
	const back = group.getObjectByName("greybox:back");
	if (!(seat instanceof Mesh) || !(back instanceof Mesh))
		throw new Error("Missing armchair upholstery");
	expect(seat.material.color.getHexString()).toBe("416b91");
	expect(back.material.color.getHexString()).toBe("416b91");
	expect(new Box3().setFromObject(seat, true).min.y).toBeGreaterThan(0.25);
	expect(seat.getWorldPosition(new Vector3()).x).toBeLessThan(
		back.getWorldPosition(new Vector3()).x,
	);
});

it.each(catalog)(
	"%s fits the entire low-poly model in its 144 × 104 preview",
	(label, width, depth, height) => {
		const kind = telegramGreyboxKindForLabel(label);
		expect(kind).toMatch(/^catalog:/);
		const { model, camera } = createCatalogThumbnailView({
			id: kind?.slice("catalog:".length) ?? "",
			shape: "generic",
			widthMm: width,
			depthMm: depth,
			heightMm: height,
			color: "#416b91",
		});
		const bounds = new Box3();
		const point = new Vector3();
		model.traverse((mesh) => {
			if (!(mesh instanceof Mesh)) return;
			const vertices = mesh.geometry.getAttribute("position");
			for (let index = 0; index < vertices.count; index += 1) {
				bounds.expandByPoint(
					point
						.fromBufferAttribute(vertices, index)
						.applyMatrix4(mesh.matrixWorld)
						.project(camera),
				);
			}
		});
		expect(
			Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
		).toBeLessThan(0.91);
		expect(
			Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)),
		).toBeLessThan(0.91);
		expect(
			Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y),
		).toBeGreaterThan(1.7);
	},
);

it.each([
	["Ванна", 1.7, 0.7, 0.52, 0, 0.22],
	["Тумба с раковиной", 0.8, 0.48, 0.85, 0.07, 0.724],
	["Унитаз", 0.4, 0.65, 0.8, 0.12, 0.4],
] as const)(
	"keeps the opening of %s visible through a ray from above",
	(label, width, depth, height, z, below) => {
		const group = createThreeGreyboxItemGroup(
			modelItem(label, width, depth, height, "#416b91"),
		);
		group.updateMatrixWorld(true);
		const ray = new Raycaster(new Vector3(0, 2, z), new Vector3(0, -1, 0));
		const hit = ray.intersectObject(group, true)[0];
		expect(hit?.point.y).toBeLessThan(below);
		if (!(hit?.object instanceof Mesh))
			throw new Error("Missing recessed ceramic");
		expect(hit.object.material.color.getHexString()).toBe("e7e3da");
	},
);

it("draws both recessed bath profiles and their different finishes in fallback WebGL2", () => {
	const item = modelItem("Ванна", 1.7, 0.7, 0.52, "#416b91");
	const draws: {
		readonly color: readonly number[];
		readonly triangles: number;
	}[] = [];
	drawFurniture(
		item,
		true,
		(_box, color, _camera, shape) => {
			draws.push({ color, triangles: (shape?.length ?? 0) / 9 });
		},
		{ distance: 2, azimuthRadians: 0, elevationRadians: 1, panXM: 0, panZM: 0 },
	);
	expect(draws).toHaveLength(3);
	expect(draws[0]?.color).toEqual([65 / 255, 107 / 255, 145 / 255, 1]);
	expect(draws[1]?.color).toEqual([231 / 255, 227 / 255, 218 / 255, 1]);
	expect(draws[0]?.triangles).toBeGreaterThan(12);
	expect(draws[1]?.triangles).toBeGreaterThan(12);
});

it("picks a solid object through the open pane in the fallback shower silhouette", () => {
	const shower = modelItem("Душевая кабина", 0.9, 0.9, 2, "#416b91");
	const scene = {
		dimensions: { widthMm: 5000, depthMm: 5000, heightMm: 2000 },
		cameraBounds: { centerXM: 0, centerZM: 0.08, widthM: 5, depthM: 5 },
		walls: [],
		floors: [],
		items: [
			{ ...shower, assetInstanceId: "shower" },
			{
				centerXM: -1,
				centerZM: 0.08,
				centerYM: 1,
				widthM: 0.3,
				depthM: 0.3,
				heightM: 0.3,
				assetInstanceId: "behind",
			},
		],
	};
	const camera = {
		azimuthRadians: 0,
		elevationRadians: 0.15,
		distance: 2,
		panXM: 0,
		panZM: 0,
	};
	expect(
		pickProceduralSceneItem(
			scene,
			camera,
			1,
			{ x: 0, y: 0.11 },
			undefined,
			true,
		),
	).toBe("behind");
});

it.each([
	"sofa",
	"two-seat-sofa",
	"chair",
	"bed",
	"catalog:armchair",
	"catalog:chair",
	"catalog:bed",
	"catalog:single-bed",
])("points the plan symbol for %s toward local negative Z", (kind) => {
	expect(furnitureFrontFacesNegativeZ(kind)).toBe(true);
});

it.each(["catalog:corner-sofa", "catalog:dresser", "table", undefined])(
	"keeps the plan symbol for %s toward local positive Z",
	(kind) => {
		expect(furnitureFrontFacesNegativeZ(kind)).toBe(false);
	},
);

it("keeps the shower glass translucent while the frame is solid", () => {
	const model = createThreeGreyboxItemGroup(
		modelItem("Душевая кабина", 0.9, 0.9, 2, "#416b91"),
	);
	const glass = model.children.flatMap((child) =>
		child instanceof Mesh && child.material.transparent ? [child.material] : [],
	);
	expect(glass).toHaveLength(2);
	expect(
		glass.every(
			(material) =>
				!material.depthWrite &&
				material.opacity > 0.15 &&
				material.opacity < 0.4,
		),
	).toBe(true);
});

it.each([
	{ axis: "y", outline: "oval" },
	{ axis: "z", outline: "rounded", cornerRadius: 0.1 },
] as const)(
	"builds finite nondegenerate $outline triangles with the right centre and cap",
	({ axis, outline, ...options }) => {
		const shape = {
			axis,
			outline,
			...options,
			rings: [
				[0, 0.8, 0.8, -0.09, 0.08],
				[1, 0.6, 0.6, 0.14, -0.12],
			],
		} as const;
		const { positions, indices } = catalogProfileGeometry(shape);
		const vertex = (index: number) =>
			new Vector3().fromArray(positions, index * 3);
		const start = new Box3();
		for (let index = 0; index < positions.length / 3; index += 1) {
			const point = vertex(index);
			if (point[axis] === -0.5) start.expandByPoint(point);
		}
		const centre = start.getCenter(new Vector3());
		expect(centre.x).toBeCloseTo(-0.09, 6);
		expect(centre[axis === "y" ? "z" : "y"]).toBeCloseTo(0.08, 6);
		expect(start.max.x - start.min.x).toBeCloseTo(0.8, 6);
		for (let index = 0; index < indices.length; index += 3) {
			const [a, b, c] = indices.slice(index, index + 3).map(vertex);
			if (!a || !b || !c) throw new Error("Incomplete triangle");
			expect(b.sub(a).cross(c.sub(a)).length()).toBeGreaterThan(1e-6);
		}
		const open = catalogProfileGeometry({
			...shape,
			openStart: true,
			openEnd: true,
		});
		expect(open.indices.length).toBeLessThan(indices.length);
		const cornerInset = outline === "oval" ? 0.03 : 0.016;
		const outerVertex = vertex(1);
		expect(
			Math.min(
				Math.abs(outerVertex.x - start.max.x),
				Math.abs(outerVertex.x - start.min.x),
			),
		).toBeLessThan(cornerInset);
	},
);

it("picks the visible item beyond the curved edge of a floor-lamp shade in fallback WebGL2", () => {
	const lamp = modelItem("Торшер", 0.35, 0.35, 1.55, "#416b91");
	const scene = {
		dimensions: { widthMm: 5000, depthMm: 5000, heightMm: 2000 },
		cameraBounds: { centerXM: 0, centerZM: 0, widthM: 5, depthM: 5 },
		walls: [],
		floors: [],
		items: [
			{ ...lamp, assetInstanceId: "lamp" },
			{
				centerXM: -1,
				centerZM: 0.158,
				centerYM: 1.6,
				widthM: 0.2,
				depthM: 0.1,
				heightM: 0.3,
				assetInstanceId: "behind",
			},
		],
	};
	const camera = {
		azimuthRadians: 0,
		elevationRadians: 0.15,
		distance: 2,
		panXM: 0,
		panZM: 0,
	};
	expect(
		pickProceduralSceneItem(
			scene,
			camera,
			1,
			{ x: -0.021835, y: 0.18942 },
			undefined,
			true,
		),
	).toBe("behind");
	expect(pickProceduralSceneItem(scene, camera, 1, { x: 0, y: 0.16 }, undefined, true)).toBe("lamp");
});

const nearWallRoom = (() => {
	let nextId = 0;
	const time = "2026-11-26T09:00:00.000Z";
	const result = configureRectangularRoom(
		createInitialProject({
			createdAt: time,
			levelId: "level",
			name: "Catalog room",
			projectId: "project-catalog",
		}),
		{ widthMm: "6000", depthMm: "6000", heightMm: "2600" },
		{
			next: () => `room-geometry-${nextId++}`,
		},
		time,
	);
	if (result.kind !== "accepted") throw new Error("Missing catalog test room");
	const plan = resolveOrthogonalPlanFaces(result.project);
	if (plan.kind !== "accepted") throw new Error("Missing catalog test walls");
	return {
		snap: createFloorItemWallSnap(result.project),
		rooms: plan.plan.rooms,
	};
})();

it.each(catalog)(
	"%s can touch a wall and be picked on a visible part",
	(label, widthMm, depthMm, heightMm) => {
		const footprint = { widthMm, depthMm };
		const atWall = nearWallRoom.snap({
			target: { xMm: 85 + widthMm / 2, zMm: 3000 },
			footprint,
		});
		const distances = itemWallDistancesFor(nearWallRoom.rooms, {
			...footprint,
			...atWall,
		});
		expect(
			distances.some(({ distanceMm }) => Math.abs(distanceMm) < 1e-6),
		).toBe(true);
		const item = modelItem(
			label,
			widthMm / 1000,
			depthMm / 1000,
			heightMm / 1000,
			"#416b91",
		);
		const mesh = createThreeGreyboxItemGroup({
			...item,
			centerXM: atWall.xMm / 1000,
			centerZM: atWall.zMm / 1000,
		});
		const surface = new Box3().setFromObject(mesh, true);
		expect(surface.min.x).toBeCloseTo(0.05, 6);
		const detail = mesh.children.find(
			(child) =>
				child instanceof Mesh &&
				child.material.color.getHexString() === "416b91",
		);
		if (!detail) throw new Error("Missing visible body material");
		const focus = detail.getWorldPosition(new Vector3());
		const camera = new PerspectiveCamera(60, 1, 0.03, 100);
		camera.position.copy(focus).add(new Vector3(1.5, 2.1, 2.2));
		camera.lookAt(focus);
		camera.updateMatrixWorld();
		expect(
			pickThreeSceneItem(camera, { x: 0, y: 0 }, [
				{ root: mesh, assetInstanceId: "catalog-model" },
			]),
		).toBe("catalog-model");
	},
);

import { describe, expect, it } from "@rstest/core";
import { addConstrainedPartition } from "../domain/constrained-partition";
import {
	addDoorOpeningToProject,
	addWindowOpeningToProject,
} from "../domain/door-opening-project";
import {
	addGeneralWallToProject,
	reverseGeneralWall,
} from "../domain/general-wall-project";
import { createInitialProject } from "../domain/initial-project";
import { createParametricFloorItem } from "../domain/parametric-item";
import { createParametricWallItem } from "../domain/parametric-wall-item";
import type { Project } from "../domain/project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import {
	openingCreationDraftFor,
	openingCreationHostFor,
	openingCreationHostsFor,
	validateOpeningCreationDraft,
} from "./opening-creation-draft";

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function roomProject() {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-31T10:00:00.000Z",
			levelId: "level-1",
			name: "Новый проём",
			projectId: "project-1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids(
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
		),
		"2026-08-31T10:01:00.000Z",
	);
	if (configured.kind !== "accepted") {
		throw new Error("Expected an editable rectangular room fixture");
	}
	return configured.project;
}

describe("opening creation draft", () => {
	it("starts with exact millimetre defaults and a numbered wall host", () => {
		const project = roomProject();

		expect(openingCreationHostFor(project, "wall-1")).toEqual({
			heightMm: 2600,
			lengthMm: 4100,
			ordinal: 1,
			usableLengthMm: 4100,
			wallSegmentId: "wall-1",
		});
		expect(openingCreationDraftFor(project, "wall-1")).toEqual({
			heightMm: "2100",
			kind: "Door",
			offsetMm: "2000",
			sillMm: "0",
			wallSegmentId: "wall-1",
			widthMm: "900",
		});
	});

	it("keeps Add disabled for a candidate wider than the free wall interval", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1");
		if (!draft) throw new Error("Expected an opening draft");

		expect(
			validateOpeningCreationDraft(project, { ...draft, widthMm: "10000" }),
		).toEqual({
			kind: "invalid",
			message: "Ширина больше свободного участка стены.",
		});
	});

	it("preserves the entered placement millimetre and refuses an invalid candidate instead of repositioning it", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1", "Door", { baseRevisionId: "r1", offsetMm: 1301 });
		if (!draft) throw new Error("Expected a wall opening draft");
		expect(draft.baseRevisionId).toBe("r1");
		expect(validateOpeningCreationDraft(project, draft)).toMatchObject({ kind: "valid", input: { offsetMm: 1301 } });
		for (const offsetMm of ["", "1301.5", "-1"]) {
			expect(validateOpeningCreationDraft(project, { ...draft, offsetMm })).toEqual({
				kind: "invalid", message: "Укажите целое смещение в миллиметрах.",
			});
		}
		for (const offsetMm of ["449", "3651"]) {
			expect(validateOpeningCreationDraft(project, { ...draft, offsetMm }).kind).toBe("invalid");
		}
		expect(validateOpeningCreationDraft(project, { ...draft, offsetMm: "450" })).toMatchObject({ kind: "valid", input: { offsetMm: 450 } });
	});

	it("lists usable wall hosts in project order with their lengths", () => {
		const project = roomProject();
		expect(openingCreationHostsFor(project, "Window").map(host => [host.ordinal, host.wallSegmentId, host.lengthMm])).toEqual([
			[1, "wall-1", 4100], [2, "wall-2", 3100], [3, "wall-3", 4100], [4, "wall-4", 3100],
		]);
	});

	it("validates the chosen door swing and drops it when creating a window", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1");
		if (!draft) throw new Error("Expected opening draft");
		const left = { ...draft, swingSide: "left" as const };
		const door = validateOpeningCreationDraft(project, left);
		expect(door.kind === "valid" && door.input).toMatchObject({ swingSide: "left" });
		const window = validateOpeningCreationDraft(project, { ...left, kind: "Window" });
		expect(window.kind).toBe("valid");
		if (window.kind === "valid") expect(window.input).not.toHaveProperty("swingSide");
	});

	it("validates the Window branch with its own exact millimetre values", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1", "Window");
		if (!draft) throw new Error("Expected a window opening draft");

		expect(validateOpeningCreationDraft(project, draft)).toEqual({
			host: {
				heightMm: 2600,
				lengthMm: 4100,
				ordinal: 1,
				usableLengthMm: 4100,
				wallSegmentId: "wall-1",
			},
			input: {
				heightMm: 1200,
				kind: "Window",
				offsetMm: 2000,
				sillMm: 900,
				wallSegmentId: "wall-1",
				widthMm: 1200,
			},
			kind: "valid",
		});
	});

	it("rejects a non-positive millimetre field before any publish candidate exists", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1");
		if (!draft) throw new Error("Expected an opening draft");

		const invalid = {
			kind: "invalid",
			message:
				"Укажите целые положительные ширину и высоту.",
		} as const;
		expect(
			validateOpeningCreationDraft(project, { ...draft, widthMm: "0" }),
		).toEqual(invalid);
		expect(
			validateOpeningCreationDraft(project, { ...draft, heightMm: "0" }),
		).toEqual(invalid);
		expect(
			validateOpeningCreationDraft(project, {
				...draft,
				kind: "Window",
				sillMm: "-1",
			}),
		).toEqual(invalid);
		expect(
			validateOpeningCreationDraft(project, {
				...draft,
				offsetMm: "-1",
				sillMm: "legacy ignored",
			}),
		).toMatchObject({ kind: "valid", input: { offsetMm: 2000, sillMm: 0 } });
	});

	it("uses the same wall-item clearance check as durable publish", () => {
		const panel = createParametricWallItem(
			roomProject(),
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Настенная панель",
				offsetMm: 2050,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel-1"),
			"2026-08-31T10:02:00.000Z",
		);
		if (panel.kind !== "accepted") {
			throw new Error("Expected a durable wall item fixture");
		}
		const draft = openingCreationDraftFor(panel.project, "wall-1");
		if (!draft) throw new Error("Expected an opening draft");

		expect(
			validateOpeningCreationDraft(panel.project, {
				...draft,
				offsetMm: "2050",
				widthMm: "900",
			}),
		).toMatchObject({
			kind: "valid",
			input: { offsetMm: 1100, sillMm: 0 },
		});
	});

	it("finds a central free interval, allows exact edge contact and preserves the source", () => {
		const original = roomProject();
		const occupied = withOpening(withOpening(original, 900, 900), 2700, 900);
		const before = JSON.stringify(occupied);
		const draft = openingCreationDraftFor(occupied, "wall-1");
		if (!draft) throw new Error("Expected draft");
		expect(validateOpeningCreationDraft(occupied, draft)).toMatchObject({
			kind: "valid",
			input: { offsetMm: 1800, widthMm: 900 },
		});
		expect(JSON.stringify(occupied)).toBe(before);
		const full = withOpening(original, 2050, 4100);
		expect(validateOpeningCreationDraft(full, draft)).toEqual({
			kind: "invalid",
			message: "На этой стене нет свободного места для такого проёма.",
		});
	});

	it("uses an integer non-grid centre when only a narrow gap fits an odd width", () => {
		const project = withOpening(
			withOpening(roomProject(), 800, 1600),
			3301,
			1598,
		);
		const draft = openingCreationDraftFor(project, "wall-1");
		if (!draft) throw new Error("Expected draft");
		expect(
			validateOpeningCreationDraft(project, { ...draft, widthMm: "901" }),
		).toMatchObject({ kind: "valid", input: { offsetMm: 2051, widthMm: 901 } });
		expect(
			validateOpeningCreationDraft(project, { ...draft, widthMm: "903" }).kind,
		).toBe("invalid");
	});

	it("keeps the requested Window sill and height, while a new Door always starts at the floor", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1", "Window");
		if (!draft) throw new Error("Expected draft");
		expect(
			validateOpeningCreationDraft(project, { ...draft, heightMm: "1700" }),
		).toMatchObject({ kind: "valid", input: { sillMm: 900, heightMm: 1700 } });
		expect(
			validateOpeningCreationDraft(project, { ...draft, heightMm: "1701" }),
		).toEqual({
			kind: "invalid",
			message: "Проём не помещается по высоте стены.",
		});
		expect(
			validateOpeningCreationDraft(project, {
				...draft,
				heightMm: "1600",
				sillMm: "1000",
			}),
		).toMatchObject({ kind: "valid", input: { heightMm: 1600, sillMm: 1000 } });
		expect(
			validateOpeningCreationDraft(project, {
				...draft,
				kind: "Door",
				heightMm: "2600",
				sillMm: "1000",
			}),
		).toMatchObject({ kind: "valid", input: { sillMm: 0, heightMm: 2600 } });
		expect(
			validateOpeningCreationDraft(project, {
				...draft,
				kind: "Door",
				widthMm: "799",
			}),
		).toMatchObject({ kind: "invalid" });
		expect(
			validateOpeningCreationDraft(project, {
				...draft,
				kind: "Door",
				widthMm: "800",
			}),
		).toMatchObject({ kind: "valid" });
	});

	it("creates equal Telegram windows at the preset floor height regardless of old raw sill values", () => {
		const project = roomProject();
		const first = openingCreationDraftFor(project, "wall-1", "Window");
		const second = openingCreationDraftFor(project, "wall-2", "Window", { baseRevisionId: "r1", offsetMm: 1441 });
		if (!first || !second) throw new Error("Expected automatic and exact Window drafts");
		const dimensions = { widthMm: "1050", heightMm: "1700" };
		const preview = validateOpeningCreationDraft(project, { ...first, ...dimensions, sillMm: "750" }, "preset");
		const exact = validateOpeningCreationDraft(project, { ...second, ...dimensions, sillMm: "1000" }, "preset");
		if (preview.kind !== "valid" || exact.kind !== "valid") throw new Error("Both identical windows must fit above the preset sill");
		const placedFirst = addWindowOpeningToProject(project, preview.input, ids("window-1"), project.updatedAt);
		if (placedFirst.kind !== "accepted") throw new Error("First Window must publish");
		const placedSecond = addWindowOpeningToProject(placedFirst.project, exact.input, ids("window-2"), project.updatedAt);
		expect(placedSecond).toMatchObject({ kind: "accepted", project: { level: { openings: [
			{ heightMm: 1700, kind: "Window", sillMm: 900, widthMm: 1050 },
			{ heightMm: 1700, kind: "Window", offsetMm: 1441, sillMm: 900, widthMm: 1050 },
		] } } });
		expect(validateOpeningCreationDraft(project, { ...second, heightMm: "1701", sillMm: "0" }, "preset"))
			.toEqual({ kind: "invalid", message: "Проём не помещается по высоте стены." });
		expect(validateOpeningCreationDraft(project, { ...second, ...dimensions, sillMm: "750" }))
			.toMatchObject({ kind: "valid", input: { sillMm: 750 } });
		expect(validateOpeningCreationDraft(project, { ...second, kind: "Door", heightMm: "2100", sillMm: "900" }, "preset"))
			.toMatchObject({ kind: "valid", input: { sillMm: 0 } });
	});

	it("uses the conservative diagonal host and canonical direction on a reversed wall", () => {
		const added = addGeneralWallToProject(
			roomProject(),
			{
				start: { xMm: 0, zMm: 0 },
				end: { xMm: -2000, zMm: -2000 },
				thicknessMm: 100,
			},
			ids("diagonal-end", "diagonal-wall"),
			"2026-10-25T10:00:00.000Z",
		);
		if (added.kind !== "accepted") throw new Error("Expected diagonal wall");
		const draft = openingCreationDraftFor(
			added.project,
			"diagonal-wall",
			"Window",
		);
		if (!draft) throw new Error("Expected draft");
		expect(
			validateOpeningCreationDraft(added.project, {
				...draft,
				widthMm: "2828",
			}),
		).toMatchObject({
			kind: "valid",
			input: { offsetMm: 1414, widthMm: 2828 },
		});
		expect(
			validateOpeningCreationDraft(added.project, { ...draft, widthMm: "2829" })
				.kind,
		).toBe("invalid");
		const reversed = reverseGeneralWall(
			added.project,
			{ wallSegmentId: "diagonal-wall" },
			"2026-10-25T10:00:00.000Z",
		);
		if (reversed.kind !== "accepted") throw new Error("Expected reversed wall");
		expect(validateOpeningCreationDraft(reversed.project, draft)).toMatchObject(
			{ kind: "valid", input: { offsetMm: 1400 } },
		);
	});

	it("searches past a floor-item door clearance collision through the canonical validator", () => {
		const reversed = reverseGeneralWall(
			roomProject(),
			{ wallSegmentId: "wall-1" },
			"2026-10-25T10:00:00.000Z",
		);
		if (reversed.kind !== "accepted") throw new Error("Expected reversed wall");
		const furnished = createParametricFloorItem(
			reversed.project,
			{
				roomId: "room-1",
				color: "#416b91",
				label: "Шкаф",
				xMm: 2000,
				zMm: 400,
				widthMm: 600,
				depthMm: 600,
				heightMm: 1000,
			},
			ids("cabinet"),
			"2026-10-25T10:00:00.000Z",
		);
		if (furnished.kind !== "accepted") throw new Error("Expected floor item");
		const draft = openingCreationDraftFor(furnished.project, "wall-1");
		if (!draft) throw new Error("Expected draft");
		expect(
			addDoorOpeningToProject(
				furnished.project,
				{
					wallSegmentId: "wall-1",
					offsetMm: 2000,
					widthMm: 900,
					heightMm: 2100,
					sillMm: 0,
				},
				ids("probe"),
				furnished.project.updatedAt,
			),
		).toMatchObject({
			kind: "rejected",
			reasonCode: "DOOR_CLEARANCE_COLLISION",
		});
		const placement = validateOpeningCreationDraft(furnished.project, draft);
		expect(placement.kind).toBe("valid");
		if (placement.kind !== "valid") return;
		expect(placement.input.offsetMm).not.toBe(2000);
		expect(
			addDoorOpeningToProject(
				furnished.project,
				placement.input,
				ids("door"),
				furnished.project.updatedAt,
			).kind,
		).toBe("accepted");
	});

	it("uses the lower adjacent-room height for a shared wall", () => {
		const divided = addConstrainedPartition(
			roomProject(),
			{ offsetMm: 2000, orientation: "vertical" },
			ids("top", "bottom", "right-top", "left-bottom", "divider", "right-room"),
			"2026-10-25T10:00:00.000Z",
		);
		if (divided.kind !== "accepted") throw new Error("Expected shared wall");
		const project = {
			...divided.project,
			level: {
				...divided.project.level,
				rooms: divided.project.level.rooms.map((room) => ({
					...room,
					heightMm: room.roomId === "room-1" ? 2400 : 2700,
				})),
			},
		};
		const draft = openingCreationDraftFor(project, "divider");
		if (!draft) throw new Error("Expected draft");
		expect(
			validateOpeningCreationDraft(project, { ...draft, heightMm: "2400" }),
		).toMatchObject({
			kind: "valid",
			host: { heightMm: 2400 },
			input: { heightMm: 2400, sillMm: 0 },
		});
		expect(
			validateOpeningCreationDraft(project, { ...draft, heightMm: "2401" })
				.kind,
		).toBe("invalid");
	});

	it("keeps vertically touching wall items and openings on other walls out of the occupied interval set", () => {
		const source = roomProject();
		const panel = createParametricWallItem(
			source,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 500,
				heightMm: 800,
				label: "Панель",
				offsetMm: 2050,
				side: "right",
				wallSegmentId: "wall-1",
				widthMm: 900,
			},
			ids("panel"),
			source.updatedAt,
		);
		if (panel.kind !== "accepted") throw new Error("Expected wall item");
		const added = addWindowOpeningToProject(
			panel.project,
			{
				wallSegmentId: "wall-2",
				offsetMm: 1000,
				widthMm: 1000,
				heightMm: 500,
				sillMm: 900,
			},
			ids("other-opening"),
			source.updatedAt,
		);
		if (added.kind !== "accepted")
			throw new Error("Expected other wall opening");
		const draft = openingCreationDraftFor(added.project, "wall-1", "Window");
		if (!draft) throw new Error("Expected draft");
		expect(validateOpeningCreationDraft(added.project, draft)).toMatchObject({
			kind: "valid",
			input: { offsetMm: 2000, sillMm: 900 },
		});
	});

	it("rejects malformed numeric dimensions and unavailable hosts before producing a ready input", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1", "Window");
		if (!draft) throw new Error("Expected draft");
		for (const widthMm of [
			" 900",
			"+900",
			"900.0",
			"9e2",
			"9007199254740992",
			"-1",
		])
			expect(
				validateOpeningCreationDraft(project, { ...draft, widthMm }).kind,
			).toBe("invalid");
		expect(openingCreationHostFor(project, "missing")).toBeUndefined();
		expect(openingCreationDraftFor(project, "missing")).toBeUndefined();
		expect(
			validateOpeningCreationDraft(project, {
				...draft,
				wallSegmentId: "missing",
			}),
		).toEqual({
			kind: "invalid",
			message: "Выберите стену, на которой можно создать проём.",
		});
	});

	it("explains a failed bounded clearance search without claiming every integer position was examined", () => {
		const reversed = reverseGeneralWall(
			roomProject(),
			{ wallSegmentId: "wall-1" },
			"2026-10-25T10:00:00.000Z",
		);
		if (reversed.kind !== "accepted") throw new Error("Expected wall");
		const filled = createParametricFloorItem(
			reversed.project,
			{
				roomId: "room-1",
				color: "#416b91",
				label: "Занятая комната",
				xMm: 2050,
				zMm: 1550,
				widthMm: 4000,
				depthMm: 3000,
				heightMm: 1000,
			},
			ids("filled-room"),
			reversed.project.updatedAt,
		);
		if (filled.kind !== "accepted")
			throw new Error("Expected full room footprint");
		const draft = openingCreationDraftFor(filled.project, "wall-1");
		if (!draft) throw new Error("Expected draft");
		expect(validateOpeningCreationDraft(filled.project, draft)).toEqual({
			kind: "invalid",
			message:
				"Не удалось подобрать свободное место. Уменьшите ширину или выберите другую стену.",
		});
	});

	it("reserves an odd-width narrow gap between wall items rather than giving up after grid candidates", () => {
		const source = roomProject();
		const first = createParametricWallItem(
			source,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Левая панель",
				offsetMm: 800,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 1600,
			},
			ids("left"),
			source.updatedAt,
		);
		if (first.kind !== "accepted") throw new Error("Expected first wall item");
		const second = createParametricWallItem(
			first.project,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Правая панель",
				offsetMm: 3301,
				side: "right",
				wallSegmentId: "wall-1",
				widthMm: 1598,
			},
			ids("right"),
			source.updatedAt,
		);
		if (second.kind !== "accepted")
			throw new Error("Expected second wall item");
		const draft = openingCreationDraftFor(second.project, "wall-1");
		if (!draft) throw new Error("Expected draft");
		expect(
			validateOpeningCreationDraft(second.project, {
				...draft,
				widthMm: "901",
			}),
		).toMatchObject({ kind: "valid", input: { offsetMm: 2051, widthMm: 901 } });
	});

	it("can search past a wall-item collision at the initial boundary probe", () => {
		const source = roomProject();
		const panel = createParametricWallItem(
			source,
			{
				color: "#416b91",
				depthMm: 50,
				elevationMm: 1300,
				heightMm: 600,
				label: "Край стены",
				offsetMm: 800,
				side: "left",
				wallSegmentId: "wall-1",
				widthMm: 1600,
			},
			ids("panel"),
			source.updatedAt,
		);
		if (panel.kind !== "accepted") throw new Error("Expected wall item");
		const draft = openingCreationDraftFor(panel.project, "wall-1");
		if (!draft) throw new Error("Expected draft");
		expect(validateOpeningCreationDraft(panel.project, draft)).toMatchObject({
			kind: "valid",
			input: { offsetMm: 2100 },
		});
	});

	it("does not project a wall item from another wall or a vertically touching item into this opening interval", () => {
		for (const input of [
			{
				wallSegmentId: "wall-2",
				elevationMm: 1300,
				heightMm: 600,
				offsetMm: 1500,
			},
			{
				wallSegmentId: "wall-1",
				elevationMm: 2300,
				heightMm: 400,
				offsetMm: 2050,
			},
		]) {
			const source = roomProject();
			const panel = createParametricWallItem(
				source,
				{
					color: "#416b91",
					depthMm: 50,
					label: "Другая зона",
					side: "left",
					widthMm: 900,
					...input,
				},
				ids("panel"),
				source.updatedAt,
			);
			if (panel.kind !== "accepted") throw new Error("Expected wall item");
			const draft = openingCreationDraftFor(panel.project, "wall-1", "Window");
			if (!draft) throw new Error("Expected draft");
			expect(validateOpeningCreationDraft(panel.project, draft)).toMatchObject({
				kind: "valid",
				input: { offsetMm: 2000 },
			});
		}
	});

	it("reports the selected wall's actual ordinal and length, and fails closed if its derived host is unavailable", () => {
		const project = roomProject();
		expect(openingCreationHostFor(project, "wall-2")).toMatchObject({
			lengthMm: 3100,
			usableLengthMm: 3100,
			ordinal: 2,
		});
		expect(openingCreationHostFor(project, "wall-3")).toMatchObject({
			lengthMm: 4100,
			usableLengthMm: 4100,
			ordinal: 3,
		});
		const invalid = {
			...project,
			level: {
				...project.level,
				rooms: project.level.rooms.map((room) => ({ ...room, heightMm: 0 })),
			},
		};
		expect(openingCreationHostFor(invalid, "wall-1")).toBeUndefined();
		const draft = openingCreationDraftFor(project, "wall-1");
		if (!draft) throw new Error("Expected draft");
		expect(validateOpeningCreationDraft(invalid, draft)).toEqual({
			kind: "invalid",
			message: "Выберите стену, на которой можно создать проём.",
		});
	});

	it("explains exact minimum, fit and grammar failures without referring to hidden offsets", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1", "Window");
		if (!draft) throw new Error("Expected draft");
		expect(
			validateOpeningCreationDraft(project, { ...draft, widthMm: "10000" }),
		).toEqual({
			kind: "invalid",
			message: "Ширина больше свободного участка стены.",
		});
		expect(
			validateOpeningCreationDraft(project, {
				...draft,
				kind: "Door",
				widthMm: "799",
			}),
		).toEqual({
			kind: "invalid",
			message: "Ширина дверного проёма должна быть не менее 800 мм.",
		});
		for (const sillMm of ["0e0", "0.0", "0 ", "+0", "9007199254740992"])
			expect(
				validateOpeningCreationDraft(project, { ...draft, sillMm }).kind,
			).toBe("invalid");
		const odd = configureRectangularRoom(
			createInitialProject({
				createdAt: project.createdAt,
				levelId: "odd-level",
				name: "Odd",
				projectId: "odd-project",
			}),
			{ depthMm: "3000", heightMm: "2600", widthMm: "4001" },
			ids("a", "b", "c", "d", "odd-wall", "f", "g", "h", "odd-room"),
			project.updatedAt,
		);
		if (odd.kind !== "accepted") throw new Error("Expected odd host");
		const oddDraft = openingCreationDraftFor(odd.project, "odd-wall", "Window");
		if (!oddDraft) throw new Error("Expected draft");
		expect(
			validateOpeningCreationDraft(odd.project, {
				...oddDraft,
				widthMm: "4101",
			}),
		).toEqual({
			kind: "invalid",
			message: "Проём не помещается в свободный участок стены.",
		});
	});

	it("uses a central exact fallback inside a narrow interval and keeps a sole valid grid point preferred", () => {
		const project = roomProject();
		const draft = openingCreationDraftFor(project, "wall-1", "Window");
		if (!draft) throw new Error("Expected draft");
		expect(
			validateOpeningCreationDraft(project, { ...draft, widthMm: "4001" }),
		).toMatchObject({ kind: "valid", input: { offsetMm: 2050 } });
		const occupiedEdge = withOpening(project, 4099, 1);
		expect(
			validateOpeningCreationDraft(occupiedEdge, { ...draft, widthMm: "4000" }),
		).toMatchObject({ kind: "valid", input: { offsetMm: 2000 } });
		expect(
			validateOpeningCreationDraft(project, { ...draft, widthMm: "1" }),
		).toMatchObject({ kind: "valid", input: { widthMm: 1, offsetMm: 2000 } });
	});

	it("keeps the backwards-compatible initial draft offset within a short host", () => {
		const source = roomProject();
		const short = addGeneralWallToProject(
			source,
			{
				start: { xMm: 0, zMm: 0 },
				end: { xMm: 0, zMm: -940 },
				thicknessMm: 100,
			},
			ids("short-end", "short-wall"),
			source.updatedAt,
		);
		if (short.kind !== "accepted") throw new Error("Expected short wall");
		expect(openingCreationDraftFor(short.project, "short-wall")).toMatchObject({
			offsetMm: "490",
		});
		const draft = openingCreationDraftFor(short.project, "short-wall");
		if (!draft) throw new Error("Expected draft");
		expect(validateOpeningCreationDraft(short.project, draft)).toMatchObject({
			kind: "valid",
			input: { offsetMm: 470 },
		});
	});

	it("keeps a narrow exact gap when wall items cross the opening's upper or lower vertical boundary", () => {
		for (const [kind, elevationMm] of [
			["Door", 2100],
			["Window", 900],
		] as const) {
			const source = roomProject();
			const first = createParametricWallItem(
				source,
				{
					color: "#416b91",
					depthMm: 50,
					elevationMm,
					heightMm: 600,
					label: "Слева",
					offsetMm: 800,
					side: "left",
					wallSegmentId: "wall-1",
					widthMm: 1600,
				},
				ids("left"),
				source.updatedAt,
			);
			if (first.kind !== "accepted") throw new Error("Expected first item");
			const second = createParametricWallItem(
				first.project,
				{
					color: "#416b91",
					depthMm: 50,
					elevationMm,
					heightMm: 600,
					label: "Справа",
					offsetMm: 3301,
					side: "right",
					wallSegmentId: "wall-1",
					widthMm: 1598,
				},
				ids("right"),
				source.updatedAt,
			);
			if (second.kind !== "accepted") throw new Error("Expected second item");
			const draft = openingCreationDraftFor(second.project, "wall-1", kind);
			if (!draft) throw new Error("Expected draft");
			expect(
				validateOpeningCreationDraft(second.project, {
					...draft,
					widthMm: "901",
				}),
			).toMatchObject({ kind: "valid", input: { offsetMm: 2051 } });
		}
	});
});

function withOpening(
	project: Project,
	offsetMm: number,
	widthMm: number,
): Project {
	const added = addWindowOpeningToProject(
		project,
		{ wallSegmentId: "wall-1", offsetMm, widthMm, heightMm: 500, sillMm: 900 },
		ids(`opening-${offsetMm}`),
		project.updatedAt,
	);
	if (added.kind !== "accepted")
		throw new Error("Expected valid existing opening");
	return added.project;
}

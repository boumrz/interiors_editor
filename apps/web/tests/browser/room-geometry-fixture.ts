import { expect, type Page } from "@playwright/test";

/** These fixtures create a rectangular Room; its rendered floor owns the placement point. */
export async function clickRectangularRoomCentre(page: Page): Promise<void> {
	await clickRectangularRoomPoint(page, { x: 0.5, y: 0.5 });
}

/** Fractions address the Room's local bounds, independent of the placement dock's fit. */
export async function clickRectangularRoomPoint(
	page: Page,
	fraction: { readonly x: number; readonly y: number },
): Promise<void> {
	const face = page.getByTestId("room-face").first();
	await expect(face).toBeVisible();
	const position = await face.evaluate(async (element, pointFraction) => {
		const polygon = element as SVGGraphicsElement;
		const canvas = polygon.ownerSVGElement;
		if (!canvas) throw new Error("Expected the Room's Plan canvas");
		const sample = () => {
			const matrix = polygon.getScreenCTM();
			if (!matrix) throw new Error("Expected the Room's screen transform");
			const room = polygon.getBBox();
			const bounds = canvas.getBoundingClientRect();
			const centre = new DOMPoint(
				room.x + room.width * pointFraction.x,
				room.y + room.height * pointFraction.y,
			).matrixTransform(matrix);
			return {
				key: JSON.stringify([
					matrix.a,
					matrix.b,
					matrix.c,
					matrix.d,
					matrix.e,
					matrix.f,
					room.x,
					room.y,
					room.width,
					room.height,
					bounds.x,
					bounds.y,
					bounds.width,
					bounds.height,
				]),
				position: { x: centre.x - bounds.x, y: centre.y - bounds.y },
			};
		};
		let previous = sample();
		let stableFrames = 0;
		for (let frame = 0; frame < 120; frame += 1) {
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => resolve()),
			);
			const current = sample();
			stableFrames = current.key === previous.key ? stableFrames + 1 : 0;
			if (stableFrames === 2) return current.position;
			previous = current;
		}
		throw new Error("Room geometry did not settle for two animation frames");
	}, fraction);
	await page.getByTestId("plan-canvas").click({
		position,
	});
}

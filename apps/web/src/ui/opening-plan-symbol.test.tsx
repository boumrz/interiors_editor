import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { DoorSwingPicker } from "./door-swing-picker";
import { OpeningPlanSymbol } from "./opening-plan-symbol";

it.each([
	["left", 1],
	["right", -1],
	[undefined, -1],
] as const)(
	"draws a door leaf and its quarter circle on the durable swing side %s",
	(swingSide, sign) => {
		const diagram = renderToStaticMarkup(
			<svg role="img" aria-label="Проём">
				<OpeningPlanSymbol
					kind="Door"
					swingSide={swingSide}
					start={{ x: 10, y: 20 }}
					end={{ x: 10, y: 50 }}
					thickness={3}
				/>
			</svg>,
		);
		expect(diagram).toContain("translate(10 20) rotate(90)");
		expect(diagram).toContain('data-testid="door-leaf"');
		expect(diagram).toContain(`y2="${30 * sign}"`);
		expect(diagram).toContain(
			`M30 0 A30 30 0 0 ${sign === 1 ? 1 : 0} 0 ${30 * sign}`,
		);
	},
);
it("draws the window frame with two pane rails and a central mullion", () => {
	const diagram = renderToStaticMarkup(
		<svg role="img" aria-label="Проём">
			<OpeningPlanSymbol
				kind="Window"
				start={{ x: 0, y: 1 }}
				end={{ x: -60, y: 1 }}
				thickness={5}
			/>
		</svg>,
	);
	expect(diagram).toContain("rotate(180)");
	expect(diagram).toContain('data-testid="window-frame"');
	expect(diagram.match(/data-testid="window-opening-pane"/g)).toHaveLength(2);
	expect(diagram).toContain('x1="30"');
	expect(diagram).not.toContain("door-leaf");
});

it("labels the two swing directions and exposes the stored selection", () => {
	const markup = renderToStaticMarkup(
		<DoorSwingPicker value="left" disabled onChange={() => undefined} />,
	);
	expect(markup).toContain("Направление открывания");
	expect(markup).toMatch(
		/<button[^>]*aria-pressed="true"[^>]*disabled=""[^>]*>Влево<\/button>/,
	);
	expect(markup).toMatch(
		/<button[^>]*aria-pressed="false"[^>]*disabled=""[^>]*>Вправо<\/button>/,
	);
});

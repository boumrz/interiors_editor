import { describe, expect, it } from "@rstest/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TmaFloorItemTabs } from "./TmaFloorItemTabs";

describe("mobile floor item tabs", () => {
	it("keeps the inactive fields mounted in their own hidden tab panels", () => {
		const output = renderToStaticMarkup(createElement(TmaFloorItemTabs, {
			active: "walls",
			onChange: () => undefined,
			sizes: "Uncommitted size",
			walls: "Current wall clearance",
			settings: "Item actions",
		}));
		const labels = [...output.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map((match) => match[1]);
		expect(labels).toEqual(["Размеры", "До стен", "Настройки"]);
		expect(output).toContain('aria-selected="true"');
		expect(output).toContain("Uncommitted size");
		expect(output).toMatch(/hidden=""[^>]*>Uncommitted size/);
	});
});

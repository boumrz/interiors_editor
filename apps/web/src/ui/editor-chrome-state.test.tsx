import { describe, expect, it } from "@rstest/core";
import { projectHubChromeReset } from "./editor-chrome-state";

describe("project-hub editor chrome reset", () => {
	it("closes the secondary action surface and returns the editor to Plan", () => {
		expect(projectHubChromeReset()).toEqual({
			actionMenuOpen: false,
			viewMode: "plan",
		});
	});
});

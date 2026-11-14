import { describe, expect, it } from "@rstest/core";

import { projectDeletionTargetText } from "./project-deletion-copy";

describe("projectDeletionTargetText", () => {
	it("names the exact Project that irreversible confirmation will delete", () => {
		expect(projectDeletionTargetText("План для полного удаления")).toBe(
			"Будет безвозвратно удалён проект «План для полного удаления».",
		);
	});
});

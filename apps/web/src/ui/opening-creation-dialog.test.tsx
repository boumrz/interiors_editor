import { describe, expect, it } from "@rstest/core";

import { openingCreationDialogKeyAction } from "./opening-creation-dialog";

describe("opening creation dialog keyboard contract", () => {
	it("dismisses an idle sheet on Escape but blocks Escape while a publish is working", () => {
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 0,
				focusableCount: 8,
				isWorking: false,
				key: "Escape",
				shiftKey: false,
			}),
		).toBe("dismiss");
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 0,
				focusableCount: 0,
				isWorking: true,
				key: "Escape",
				shiftKey: false,
			}),
		).toBe("block");
	});

	it("cycles the last and first active control only at the respective Tab boundary", () => {
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 7,
				focusableCount: 8,
				isWorking: false,
				key: "Tab",
				shiftKey: false,
			}),
		).toBe("focus-first");
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 0,
				focusableCount: 8,
				isWorking: false,
				key: "Tab",
				shiftKey: true,
			}),
		).toBe("focus-last");
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 0,
				focusableCount: 8,
				isWorking: false,
				key: "Tab",
				shiftKey: false,
			}),
		).toBe("none");
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 3,
				focusableCount: 8,
				isWorking: false,
				key: "Tab",
				shiftKey: true,
			}),
		).toBe("none");
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 3,
				focusableCount: 8,
				isWorking: false,
				key: "Tab",
				shiftKey: false,
			}),
		).toBe("none");
	});

	it("keeps focus on the dialog itself if no sheet control is available", () => {
		expect(
			openingCreationDialogKeyAction({
				activeIndex: -1,
				focusableCount: 0,
				isWorking: false,
				key: "Tab",
				shiftKey: false,
			}),
		).toBe("retain-dialog");
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 4,
				focusableCount: 8,
				isWorking: true,
				key: "Tab",
				shiftKey: true,
			}),
		).toBe("retain-dialog");
	});

	it("does not interfere with other keyboard input", () => {
		expect(
			openingCreationDialogKeyAction({
				activeIndex: 7,
				focusableCount: 8,
				isWorking: false,
				key: "ArrowDown",
				shiftKey: false,
			}),
		).toBe("none");
	});
});

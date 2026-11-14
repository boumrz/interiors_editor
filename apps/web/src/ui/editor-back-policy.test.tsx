import { describe, expect, it } from "@rstest/core";
import { editorBackDecision } from "./editor-back-policy";

const clean = { pending: false, persistFailed: false, draft: false, panel: false, project: false };
describe("Telegram editor Back priority", () => {
	it("keeps an already dispatched command ahead of failure, draft and panel navigation", () => {
		expect(editorBackDecision({ pending: true, persistFailed: true, draft: true, panel: true, project: true })).toBe("saving");
		expect(editorBackDecision({ ...clean, pending: true })).toBe("saving");
	});
	it("preserves the failed candidate and recovery route before draft or navigation", () => {
		expect(editorBackDecision({ ...clean, persistFailed: true, draft: true, panel: true, project: true })).toBe("persist-failed");
		expect(editorBackDecision({ ...clean, persistFailed: true })).toBe("persist-failed");
	});
	it("requires an explicit choice for raw input or transient drafts before closing a panel", () => {
		expect(editorBackDecision({ ...clean, draft: true, panel: true, project: true })).toBe("confirm-discard");
		expect(editorBackDecision({ ...clean, draft: true })).toBe("confirm-discard");
	});
	it("closes a clean panel before leaving the editor", () => {
		expect(editorBackDecision({ ...clean, panel: true, project: true })).toBe("close-panel");
		expect(editorBackDecision({ ...clean, panel: true })).toBe("close-panel");
	});
	it("returns a clean editor to Projects and closes the host only from clean Projects", () => {
		expect(editorBackDecision({ ...clean, project: true })).toBe("projects");
		expect(editorBackDecision(clean)).toBe("close-host");
	});
});

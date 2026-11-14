import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import type {
	ProjectController,
	ProjectScreenState,
} from "../app/project-controller";
import { createInitialProject } from "../domain/initial-project";
import { AppShell } from "./AppShell";

/** Presentation-only contract double; no storage, publication or host evidence. */
function controller(state: ProjectScreenState): ProjectController {
	return {
		open: async () => undefined,
		sessionHistory: () => ({ canUndo: false, canRedo: false }),
		snapshot: () => state,
		subscribe: () => () => undefined,
		writerAccess: () => ({ kind: "not-ready" }),
	} as unknown as ProjectController;
}
for (const state of [
	{ kind: "projects", projects: [] },
	{ kind: "first-run" },
] as const)
	it(`keeps the local diagnostic disclosure available on the ${state.kind} surface`, () => {
		const html = renderToStaticMarkup(
			<AppShell
				controller={controller(state)}
				diagnosticDetails={<span>LOCAL_TECHNICAL_RECORD</span>}
			/>,
		);
		expect(html).toContain("LOCAL_TECHNICAL_RECORD");
	});
it("does not put the diagnostic disclosure into a healthy editor canvas flow", () => {
	const project = createInitialProject({
		projectId: "p",
		levelId: "l",
		name: "Healthy",
		createdAt: "2026-11-05T00:00:00.000Z",
	});
	const html = renderToStaticMarkup(
		<AppShell
			controller={controller({
				kind: "saved",
				project,
				projectName: project.name,
				revisionId: "r",
			})}
			diagnosticDetails={<span>LOCAL_TECHNICAL_RECORD</span>}
		/>,
	);
	expect(html).not.toContain("LOCAL_TECHNICAL_RECORD");
	expect(html).toContain('id="editor-canvas"');
});

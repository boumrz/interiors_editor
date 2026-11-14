import { afterEach, expect, it, rs } from "@rstest/core";
import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProjectStorageNamespace } from "../application/ports";
import type { BrowserReadonlyProjectsPort } from "../app/browser-readonly-projects-port";
import type { BrowserRuntimeEditorRuntime } from "../app/browser-runtime-editor";
import type { EditorAppProps } from "../app/editor-app";
import type { ProjectController } from "../app/project-controller";
import type { ReleaseRecoveryRecord } from "../app/release-startup";

// UI composition only: controller tokens are opaque and never called. No database or publication claim.
afterEach(() => {
	rs.doUnmock("../app/editor-app");
	rs.resetModules();
});
function children(node: ReactNode): ReactNode[] {
	if (!isValidElement<{ children?: ReactNode }>(node)) return [];
	return Children.toArray(node.props.children);
}
async function composition(options: {
	sources: readonly ProjectStorageNamespace[];
	recovery?: ReleaseRecoveryRecord;
	reader?: boolean;
	admitted?: boolean;
}) {
	rs.resetModules();
	rs.doMock("../app/editor-app", { spy: true });
	const editor = await import("../app/editor-app");
	let captured: EditorAppProps | undefined;
	rs.mocked(editor.EditorApp).mockImplementation((props) => {
		captured = props;
		return <></>;
	});
	const controller = {} as ProjectController;
	const signal = new AbortController().signal;
	const reader: BrowserReadonlyProjectsPort = {
		signal,
		getSourceSignal: () => signal,
		getSourceRecovery: () => undefined,
		readDirectory: async () => ({
			kind: "projects",
			projects: [],
			storageSources: [],
		}),
		exportBackup: async () => ({ kind: "verification-unavailable" }),
	};
	const snapshot = {
		key: "owned-ui-instance",
		controller,
		storageNamespace: "browser-registered" as const,
		requestedRenameProjectId: "rename",
	};
	const runtime: BrowserRuntimeEditorRuntime = {
		controller,
		releaseStartup: { handshake: async () => ({ kind: "writable" }) },
		navigationProtection: {
			discardWriterRecoveryAndShowProjects: async () => false,
		},
		getReadonlyProjectSources: () => options.sources,
		getLegacyStartupRecovery: () => options.recovery,
		getEditorInstanceSnapshot: () => snapshot,
		subscribeEditorInstance: () => () => {},
		getStartupSourcesRevision: () => 17,
		subscribeStartupSources: () => () => {},
		...(options.reader === false ? {} : { readonlyProjects: reader }),
		...(options.admitted === undefined
			? {}
			: { hasWritableSourceAdmission: () => options.admitted === true }),
	};
	const { BrowserRuntimeEditor } = await import(
		"../app/browser-runtime-editor"
	);
	renderToStaticMarkup(
		<BrowserRuntimeEditor
			runtime={runtime}
			catalogGateway={{
				currentPublication: async () => ({ kind: "unavailable" }),
				resource: async () => ({ kind: "unavailable" }),
			}}
			readReleaseStartupInput={async () => ({
				shellManifest: undefined,
				workerManifest: undefined,
				capabilities: { indexeddb: false, webgl2: false },
			})}
		/>,
	);
	expect(captured).toBeDefined();
	if (!captured) throw Error("Missing mounted editor props");
	return { props: captured, editor, runtime, reader, snapshot };
}
for (const sources of [
	["legacy"],
	["browser-registered"],
	["legacy", "browser-registered"],
	[],
] as const)
	it(`keeps exact legacy recovery bytes accessible beside independently qualified UI sources ${sources.join("+") || "all writable"}`, async () => {
		const recovery = {
			projectId: "legacy-id",
			serializedProject: '{"schemaVersion":7}',
		};
		const f = await composition({ sources, recovery });
		for (const node of [f.props.readonlyContent, f.props.readonlyDetails]) {
			const component = children(node).find(
				(child) =>
					isValidElement(child) &&
					child.type === f.editor.ReleaseRecoveryScreen,
			);
			expect(component).toBeDefined();
			if (
				!isValidElement<{ recovery: ReleaseRecoveryRecord; embedded: boolean }>(
					component,
				)
			)
				throw Error("Missing actual recovery component");
			expect(component.props.recovery).toBe(recovery);
			expect(component.props.embedded).toBe(true);
			const html = renderToStaticMarkup(component);
			expect(html.startsWith("<section")).toBe(true);
			expect(html).toContain("Скачать копию для восстановления");
		}
		expect(f.props.editorController).toBe(f.snapshot.controller);
		expect(f.props.editorInstanceKey).toBe(f.snapshot.key);
		expect(f.props.editorStorageNamespace).toBe("browser-registered");
		expect(f.props.requestedRenameProjectId).toBe("rename");
		expect(f.props.navigationProtection).toBe(f.runtime.navigationProtection);
	});
for (const recovery of [undefined, {}, { projectId: "known-without-bytes" }])
	it(`never fabricates a legacy recovery download without exact serialized bytes (${String(recovery?.projectId)})`, async () => {
		const f = await composition({ sources: [], recovery });
		expect(f.props.readonlyDetails).toBeUndefined();
		expect(
			children(f.props.readonlyContent).some(
				(child) =>
					isValidElement(child) &&
					child.type === f.editor.ReleaseRecoveryScreen,
			),
		).toBe(false);
	});
it("preserves standalone legacy recovery when independent reader construction is unavailable", async () => {
	const recovery = { serializedProject: "exact raw source" };
	const f = await composition({ sources: ["legacy"], recovery, reader: false });
	expect(f.props.readonlyStorageSources).toBeUndefined();
	expect(f.props.readonlyRecoveryDetails).toBeUndefined();
	const node = f.props.readonlyContent;
	expect(
		isValidElement(node) && node.type === f.editor.ReleaseRecoveryScreen,
	).toBe(true);
	expect(renderToStaticMarkup(node).startsWith("<main")).toBe(true);
});

for (const admitted of [false, true])
	it(`forwards only the explicit trusted current writable admission (${admitted})`, async () => {
		const f = await composition({ sources: [], admitted });
		expect(f.props.writableSourceAdmitted).toBe(admitted);
	});
it("does not derive writable admission from an empty readonly list when the trusted query is absent", async () => {
	const f = await composition({ sources: [] });
	expect(f.props.writableSourceAdmitted).toBeUndefined();
});
it("keeps a disposed source refusal false even when its readonly list is empty", async () => {
	const f = await composition({ sources: [], admitted: false, reader: false });
	expect(f.props.writableSourceAdmitted).toBe(false);
});

for (const reader of [true, false])
	it(`keeps an available empty raw legacy record accessible when independent reader is ${reader ? "available" : "unavailable"}`, async () => {
		const recovery = { projectId: "empty-legacy", serializedProject: "" };
		const f = await composition({ sources: ["legacy"], recovery, reader });
		const nodes = reader
			? children(f.props.readonlyContent)
			: [f.props.readonlyContent];
		const component = nodes.find(
			(node) =>
				isValidElement(node) && node.type === f.editor.ReleaseRecoveryScreen,
		);
		expect(component).toBeDefined();
		if (!isValidElement<{ recovery: ReleaseRecoveryRecord }>(component))
			throw Error("Missing available raw recovery source");
		expect(component.props.recovery).toBe(recovery);
		expect(renderToStaticMarkup(component)).toContain(
			"Скачать копию для восстановления",
		);
	});

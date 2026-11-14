import { afterEach, expect, it, rs } from "@rstest/core";
import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BrowserReadonlyProjectsPort } from "../app/browser-readonly-projects-port";
import type { BrowserRuntimeEditorRuntime } from "../app/browser-runtime-editor";
import type { EditorAppProps } from "../app/editor-app";
import type { ProjectController } from "../app/project-controller";

// Composition boundary only: opaque controller token, no storage or writable admission proof.
afterEach(() => {
	rs.doUnmock("../app/editor-app");
	rs.resetModules();
});
async function compose(options: {
	readonly reader: boolean;
	readonly readonlyGetter: boolean;
	readonly recoveryGetter: boolean;
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
	const snapshot = Object.freeze({ key: "optional-port-instance", controller });
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
	const runtime: BrowserRuntimeEditorRuntime = {
		controller,
		releaseStartup: { handshake: async () => ({ kind: "writable" }) },
		getEditorInstanceSnapshot: () => snapshot,
		subscribeEditorInstance: () => () => undefined,
		getStartupSourcesRevision: () => 1,
		subscribeStartupSources: () => () => undefined,
		...(options.reader ? { readonlyProjects: reader } : {}),
		...(options.readonlyGetter
			? { getReadonlyProjectSources: () => ["legacy"] as const }
			: {}),
		...(options.recoveryGetter
			? { getLegacyStartupRecovery: () => undefined }
			: {}),
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
	if (!captured)
		throw new Error("Actual common-editor props were not produced");
	return { props: captured, editor, reader };
}
it("uses an empty known readonly list when its optional getter is absent and never invents an unknown owner", async () => {
	const { props } = await compose({
		reader: true,
		readonlyGetter: false,
		recoveryGetter: true,
	});
	expect(props.readonlyStorageSources).toEqual([]);
	expect(props.readonlyDetails).toBeUndefined();
	const rawOnly = props.readonlyRecoveryDetails;
	expect(
		isValidElement<{ sourceNamespaces: readonly string[]; rawOnly: boolean }>(
			rawOnly,
		),
	).toBe(true);
	if (
		!isValidElement<{ sourceNamespaces: readonly string[]; rawOnly: boolean }>(
			rawOnly,
		)
	)
		throw new Error("Missing owned supplemental source surface");
	expect(rawOnly.props.sourceNamespaces).toEqual([
		"legacy",
		"browser-registered",
	]);
	expect(rawOnly.props.rawOnly).toBe(true);
});
it("preserves the independent readable source surface when the optional old recovery getter is absent", async () => {
	const { props, editor, reader } = await compose({
		reader: true,
		readonlyGetter: true,
		recoveryGetter: false,
	});
	expect(props.readonlyStorageSources).toEqual(["legacy"]);
	expect(props.readonlyContent).toBeDefined();
	expect(props.readonlyDetails).toBeDefined();
	const details = props.readonlyDetails;
	expect(isValidElement<{ children: ReactNode }>(details)).toBe(true);
	if (!isValidElement<{ children: ReactNode }>(details))
		throw new Error("Missing independent readonly composition");
	const children = Children.toArray(details.props.children);
	expect(children).toHaveLength(1);
	const source = children[0];
	expect(
		isValidElement<{
			port: BrowserReadonlyProjectsPort;
			sourceNamespaces: readonly string[];
			supplemental: boolean;
		}>(source),
	).toBe(true);
	if (
		!isValidElement<{
			port: BrowserReadonlyProjectsPort;
			sourceNamespaces: readonly string[];
			supplemental: boolean;
		}>(source)
	)
		throw new Error("Missing owned readonly source child");
	expect(source.props.port).toBe(reader);
	expect(source.props.sourceNamespaces).toEqual(["legacy"]);
	expect(source.props.supplemental).toBe(true);
	expect(editor.EditorApp).toHaveBeenCalledTimes(1);
});
it("keeps the old no-reader composition available when both optional recovery callbacks are absent", async () => {
	const { props } = await compose({
		reader: false,
		readonlyGetter: false,
		recoveryGetter: false,
	});
	expect(props.readonlyStorageSources).toBeUndefined();
	expect(props.readonlyContent).toBeUndefined();
	expect(props.readonlyDetails).toBeUndefined();
	expect(props.readonlyRecoveryDetails).toBeUndefined();
});

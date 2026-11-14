import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import {
	LegacyStartupRecoveryNotice,
	prepareLegacyStartupRecoveryFile,
} from "./legacy-startup-recovery";

it("preserves every original UTF16 code unit in a distinctly unverified source file and does not invent an unknown Revision identity", () => {
	const source = 'bad-json:{"name":"\ud800"}\u0000';
	const prepared = prepareLegacyStartupRecoveryFile({
		projectId: "legacy\udfff",
		serializedProject: source,
	});
	expect(prepared.kind).toBe("prepared-source");
	if (prepared.kind !== "prepared-source")
		throw new Error("Missing source copy");
	expect(prepared.filename).toBe("project.interiors-source.json");
	expect(prepared.mimeType).toBe("application/json");
	expect(JSON.parse(new TextDecoder().decode(prepared.bytes))).toEqual({
		purpose: "interiors-editor-unverified-source",
		version: 1,
		kind: "unverified-source",
		projectId: "legacy\udfff",
		revisionId: "",
		serializedProject: source,
	});
});
it("keeps an available empty source text exact while leaving unknown identifiers explicitly empty", () => {
	const prepared = prepareLegacyStartupRecoveryFile({ serializedProject: "" });
	expect(prepared.kind).toBe("prepared-source");
	if (prepared.kind !== "prepared-source")
		throw new Error("Missing empty source");
	expect(JSON.parse(new TextDecoder().decode(prepared.bytes))).toMatchObject({
		projectId: "",
		revisionId: "",
		serializedProject: "",
	});
});
it("does not fabricate a file when no readable original source was supplied", () => {
	expect(prepareLegacyStartupRecoveryFile(undefined)).toEqual({
		kind: "unavailable",
	});
	expect(prepareLegacyStartupRecoveryFile({ projectId: "p" })).toEqual({
		kind: "unavailable",
	});
});
it("checks the existing byte budget before preparing a partial or oversized source download", () => {
	expect(
		prepareLegacyStartupRecoveryFile(
			{ serializedProject: "x".repeat(100) },
			64,
		),
	).toEqual({ kind: "too-large" });
});
it("keeps ordinary healthy pages unchanged and labels the old source independently of the healthy private editor", () => {
	expect(renderToStaticMarkup(<LegacyStartupRecoveryNotice />)).toBe("");
	const html = renderToStaticMarkup(
		<LegacyStartupRecoveryNotice
			getRecovery={() => ({
				serializedProject: "private raw data never rendered",
			})}
		/>,
	);
	expect(html).toContain("Исходная запись Web/PWA");
	expect(html).toContain("Сохранить исходную запись");
	expect(html).not.toContain("private raw data never rendered");
});
it("makes missing readable source explicit without offering an unusable download", () => {
	const html = renderToStaticMarkup(
		<LegacyStartupRecoveryNotice getRecovery={() => ({})} />,
	);
	expect(html).toContain("Доступной исходной записи для скачивания нет.");
	expect(html).not.toContain("<button");
});

it("reports a local encoding allocation refusal without mislabelling an existing source as missing", () => {
	const NativeEncoder = globalThis.TextEncoder;
	globalThis.TextEncoder = class extends NativeEncoder {
		override encode(): Uint8Array<ArrayBuffer> {
			throw new RangeError("Controlled allocation refusal");
		}
	};
	try {
		expect(
			prepareLegacyStartupRecoveryFile({
				serializedProject: "Exact source remains available",
			}),
		).toEqual({ kind: "preparation-failed" });
	} finally {
		globalThis.TextEncoder = NativeEncoder;
	}
});

it("offers a collapsed disclosure in the editor instead of inserting an expanded panel into its canvas flow", () => {
	const html = renderToStaticMarkup(
		<LegacyStartupRecoveryNotice
			presentation="floating"
			getRecovery={() => ({ serializedProject: "owned raw source" })}
		/>,
	);
	expect(html).toMatch(/^<details\b/);
	expect(html).toContain("<summary>Исходная запись Web/PWA</summary>");
	expect(html).not.toMatch(/^<details[^>]*\bopen/);
	expect(html).not.toContain("owned raw source");
});

it("refuses a readable raw record whose supplied Project identifier is not text", () => {
	for (const projectId of [0, false, null, {}, []])
		expect(
			prepareLegacyStartupRecoveryFile({
				projectId: projectId as never,
				serializedProject: "exact original",
			}),
		).toEqual({ kind: "unavailable" });
});

import { describe, expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import type { UnverifiedProjectSource } from "../application/ports";
import {
	prepareUnverifiedSourceFile,
	StoredSourceRecovery,
} from "./stored-source-recovery";

const source = (serializedProject: string): UnverifiedProjectSource => ({
	kind: "unverified-source",
	projectId: "project\ud800",
	revisionId: "revision\udfff",
	serializedProject,
});
describe("explicit stored-source recovery", () => {
	it("accepts a bounded small source with a valid pair and the existing maximum policy", () => {
		for (const raw of ["x", "\ud800\udc00", ""]) {
			expect(prepareUnverifiedSourceFile(source(raw), 1000).kind).toBe(
				"prepared-source",
			);
		}
		expect(
			prepareUnverifiedSourceFile(source(""), 200 * 1024 * 1024).kind,
		).toBe("prepared-source");
	});
	it("counts each source field independently at the byte limit, including empty text and mixed surrogate neighbours", () => {
		for (const raw of [
			"",
			" ",
			"\u0800x",
			"\u0800\udc00",
			"\ud800x",
			"\ud800\ud800",
			"\ud800\ue000",
			"\udc00\udc00",
			"\udc00\ud800",
			"\udbff\udfff",
			"\ud800\udc00x",
		]) {
			for (const key of [
				"projectId",
				"revisionId",
				"serializedProject",
			] as const) {
				const input: UnverifiedProjectSource = {
					kind: "unverified-source",
					projectId: "p",
					revisionId: "r",
					serializedProject: "",
					[key]: raw,
				};
				const file = prepareUnverifiedSourceFile(input, 1000);
				if (file.kind !== "prepared-source")
					throw new Error("Missing bounded file");
				expect(
					prepareUnverifiedSourceFile(input, file.bytes.byteLength),
				).toEqual(file);
				expect(
					prepareUnverifiedSourceFile(input, file.bytes.byteLength - 1),
				).toEqual({ kind: "too-large" });
				expect(JSON.parse(new TextDecoder().decode(file.bytes))[key]).toBe(raw);
			}
		}
	});
	it("encodes the original UTF16 source losslessly without declaring a backup or recovery draft", () => {
		const original = source(
			'  \u0000\u0008\t\n\f\r " \\ \ud800 \udfff \ud83d\ude80 \u2028 \u2029 é 中  ',
		);
		const result = prepareUnverifiedSourceFile(original);
		expect(result.kind).toBe("prepared-source");
		if (result.kind !== "prepared-source") throw new Error("Missing file");
		expect(result.filename).toBe("project.interiors-source.json");
		expect(result.mimeType).toBe("application/json");
		const decoded = JSON.parse(
			new TextDecoder("utf-8", { fatal: true }).decode(result.bytes),
		);
		expect(decoded).toEqual({
			purpose: "interiors-editor-unverified-source",
			version: 1,
			kind: "unverified-source",
			projectId: original.projectId,
			revisionId: original.revisionId,
			serializedProject: original.serializedProject,
		});
		expect(Object.keys(decoded)).not.toContain("format");
		expect(original.serializedProject).toBe(decoded.serializedProject);
	});
	it("applies its byte bound inclusively using exact JSON UTF8 size before allocating output", () => {
		const input = source('é中\ud83d\ude80\ud800\udfff\u0000\n"\\');
		const full = prepareUnverifiedSourceFile(input);
		if (full.kind !== "prepared-source") throw new Error("Missing file");
		expect(prepareUnverifiedSourceFile(input, full.bytes.byteLength)).toEqual(
			full,
		);
		expect(
			prepareUnverifiedSourceFile(input, full.bytes.byteLength - 1),
		).toEqual({ kind: "too-large" });
		expect(prepareUnverifiedSourceFile(source("x".repeat(10000)), 100)).toEqual(
			{ kind: "too-large" },
		);
	});
	it("bounds every JSON escape and UTF8 encoding boundary exactly", () => {
		for (const raw of [
			"\u0000\u0001\u001f\b\t\n\f\r",
			"\u007f",
			"\u0080",
			"\u07ff",
			"\u0800",
			"\ud7ff",
			"\ud800",
			"\udbff",
			"\udc00",
			"\udfff",
			"\ue000",
			"\uffff",
			"\ud800\udc00",
			"\udbff\udfff",
			"\u2028\u2029",
		]) {
			const input = source(raw);
			const file = prepareUnverifiedSourceFile(input);
			if (file.kind !== "prepared-source") throw new Error("Missing file");
			expect(prepareUnverifiedSourceFile(input, file.bytes.byteLength)).toEqual(
				file,
			);
			expect(
				prepareUnverifiedSourceFile(input, file.bytes.byteLength - 1),
			).toEqual({ kind: "too-large" });
			expect(
				JSON.parse(new TextDecoder().decode(file.bytes)).serializedProject,
			).toBe(raw);
		}
	});
	it("never accepts a larger policy or an invalid bound", () => {
		for (const maximumBytes of [
			0,
			-1,
			0.5,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			200 * 1024 * 1024 + 1,
		])
			expect(() =>
				prepareUnverifiedSourceFile(source(""), maximumBytes),
			).toThrow();
	});
	it("renders an explicit read-only source action without listing or reading on mount", () => {
		let lists = 0;
		let reads = 0;
		let exports = 0;
		const markup = renderToStaticMarkup(
			<StoredSourceRecovery
				port={{
					listRecoverySources: async () => {
						lists++;
						return [];
					},
					readRecoverySource: async () => {
						reads++;
						return undefined;
					},
				}}
				onExport={async () => {
					exports++;
				}}
			/>,
		);
		expect(markup).toContain("Непроверенные исходники");
		expect(markup).toContain("Показать записи");
		expect(markup).not.toContain("Файл сохранён");
		expect(markup).not.toContain("Восстановлено");
		expect([lists, reads, exports]).toEqual([0, 0, 0]);
	});
});

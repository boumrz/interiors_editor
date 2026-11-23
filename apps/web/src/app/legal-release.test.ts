import { afterEach, expect, rstest, test } from "@rstest/core";
import {
	bundledLegalDocument,
	currentLicenseReadable,
	legalArchivePath,
} from "./legal-release";

afterEach(() => {
	rstest.unstubAllGlobals();
});

test("only readable documents from the edition shown by the entry can support acceptance", () => {
	expect(currentLicenseReadable()).toBe(false);
	rstest.stubGlobal("document", { getElementById: () => null });
	expect(currentLicenseReadable()).toBe(false);
	let source: string | undefined;
	rstest.stubGlobal("document", {
		getElementById: (id: string) =>
			id === "legal-documents-2026-11-22.2" ? { textContent: source } : null,
	});
	for (const damaged of [
		undefined,
		"",
		"not JSON",
		"null",
		"[]",
		"{}",
		'["other"]',
		JSON.stringify({ "license-agreement": 42 }),
		JSON.stringify({ "license-agreement": ["<h1>", "</main>"] }),
		JSON.stringify({ "license-agreement": "<main><h1>Лицензия</h1>" }),
		JSON.stringify({ "license-agreement": "<main>Лицензия</main>" }),
	]) {
		source = damaged;
		expect(currentLicenseReadable()).toBe(false);
	}
	const html = "<main><h1>Лицензия</h1></main>";
	const consent = "<main><h1>Отдельное согласие</h1></main>";
	source = JSON.stringify({
		"license-agreement": html,
		"analytics-consent": consent,
	});
	expect(currentLicenseReadable()).toBe(true);
	expect(bundledLegalDocument("license-agreement")).toBe(html);
	expect(bundledLegalDocument("analytics-consent")).toBe(consent);
	expect(bundledLegalDocument("privacy-policy")).toBeUndefined();
	expect(legalArchivePath("license-agreement")).toBe(
		"/legal/2026-11-22.2/license-agreement.html",
	);
});

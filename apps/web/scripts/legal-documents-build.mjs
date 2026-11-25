import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rspack } from "@rspack/core";
import { licenseRevision } from "../src/app/license-receipt.ts";
import { privacyRevision } from "../src/app/privacy-revision.ts";
import { productStatisticsRevision } from "../src/app/product-statistics-revision.ts";

export const legalDocumentNames = [
	"privacy-policy",
	"license-agreement",
	"analytics-consent",
];
const archivedPrivacy = `legal/${licenseRevision}/privacy-policy.html`;
const productConsent = "product-analytics-consent";
const recentPrivacy = "2026-11-24.1";
const archivePath = (name) => {
	const edition = name === "privacy-policy" ? privacyRevision
		: name === productConsent ? productStatisticsRevision : licenseRevision;
	return `legal/${edition}/${name}.html`;
};
export const publicLegalPaths = [
	...legalDocumentNames.flatMap((name) => [`legal/${name}.html`, archivePath(name)]),
	archivedPrivacy,
];

export class LegalDocumentsPlugin {
	constructor({ english = false } = {}) {
		this.english = english;
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap(
			"LegalDocumentsPlugin",
			(compilation) => {
				// The PWA fingerprint and the sealed Telegram inventory must cover these exact bytes.
				compilation.hooks.processAssets.tap(
					{
						name: "LegalDocumentsPlugin",
						stage: rspack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE - 1,
					},
					() => {
						const entry = compilation.getAsset("index.html");
						if (!entry) return; // Unit-test compilations inherit the config without an HTML shell.
						const documents = {};
						const englishDocuments = {};
						for (const name of this.english ? [...legalDocumentNames, productConsent] : legalDocumentNames) {
							const sourcePath = fileURLToPath(
								new URL(`../../../docs/legal/${name}.html`, import.meta.url),
							);
							compilation.fileDependencies.add(sourcePath);
							const bytes = readFileSync(sourcePath);
							const asset = new rspack.sources.RawSource(bytes);
							compilation.emitAsset(`legal/${name}.html`, asset);
							compilation.emitAsset(
								archivePath(name),
								asset,
							);
							documents[name] = bytes.toString("utf8");
							if (this.english) {
								const englishPath = fileURLToPath(new URL(`../../../docs/legal/en/${name}.html`, import.meta.url));
								compilation.fileDependencies.add(englishPath);
								const english = readFileSync(englishPath);
								compilation.emitAsset(
									archivePath(name).replace(`/${name}.html`, `/en/${name}.html`),
									new rspack.sources.RawSource(english),
								);
								englishDocuments[name] = english.toString("utf8");
							}
						}
						const previous = fileURLToPath(new URL(
							`../../../docs/legal/archive/${licenseRevision}/privacy-policy.html`,
							import.meta.url,
						));
						compilation.fileDependencies.add(previous);
						compilation.emitAsset(archivedPrivacy, new rspack.sources.RawSource(readFileSync(previous)));
						for (const languagePath of this.english ? ["", "en/"] : [""]) {
							const relative = `${recentPrivacy}/${languagePath}privacy-policy.html`;
							const previous = fileURLToPath(new URL(`../../../docs/legal/archive/${relative}`, import.meta.url));
							compilation.fileDependencies.add(previous);
							compilation.emitAsset(`legal/${relative}`, new rspack.sources.RawSource(readFileSync(previous)));
						}
						const html = entry.source.source().toString();
						const reader = (id, texts) => `<script type="application/json" id="${id}">${JSON.stringify(texts).replaceAll("<", "\\u003c")}</script>`;
						const russianReader = reader(`legal-documents-${licenseRevision}`, documents);
						const englishReader = this.english ? reader(`legal-documents-en-${licenseRevision}`, englishDocuments) : "";
						compilation.updateAsset(
							"index.html",
							new rspack.sources.RawSource(
								html.replace("</body>", () => russianReader + englishReader + "</body>"),
							),
						);
					},
				);
			},
		);
	}
}

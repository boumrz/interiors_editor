import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rspack } from "@rspack/core";
import { licenseRevision } from "../src/app/license-receipt.ts";

export const legalDocumentNames = [
	"privacy-policy",
	"license-agreement",
	"analytics-consent",
];
export const publicLegalPaths = legalDocumentNames.flatMap((name) => [
	`legal/${name}.html`,
	`legal/${licenseRevision}/${name}.html`,
]);

export class LegalDocumentsPlugin {
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
						for (const name of legalDocumentNames) {
							const sourcePath = fileURLToPath(
								new URL(`../../../docs/legal/${name}.html`, import.meta.url),
							);
							compilation.fileDependencies.add(sourcePath);
							const bytes = readFileSync(sourcePath);
							const asset = new rspack.sources.RawSource(bytes);
							compilation.emitAsset(`legal/${name}.html`, asset);
							compilation.emitAsset(
								`legal/${licenseRevision}/${name}.html`,
								asset,
							);
							documents[name] = bytes.toString("utf8");
						}
						const html = entry.source.source().toString();
						const json = JSON.stringify(documents).replaceAll("<", "\\u003c");
						const reader = `<script type="application/json" id="legal-documents-${licenseRevision}">${json}</script>`;
						compilation.updateAsset(
							"index.html",
							new rspack.sources.RawSource(
								html.replace("</body>", () => reader + "</body>"),
							),
						);
					},
				);
			},
		);
	}
}

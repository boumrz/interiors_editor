import { licenseRevision } from "./license-receipt";
import { privacyRevision } from "./privacy-revision";
import { editorLanguage } from "../ui/editor-language";

export type LegalDocumentName =
	| "privacy-policy"
	| "license-agreement"
	| "analytics-consent";

export const legalArchivePath = (name: LegalDocumentName) =>
	`/legal/${name === "privacy-policy" ? privacyRevision : licenseRevision}${editorLanguage() === "en" ? "/en" : ""}/${name}.html`;

export function bundledLegalDocument(
	name: LegalDocumentName,
): string | undefined {
	if (typeof document === "undefined") return;
	const languagePart = editorLanguage() === "en" ? "en-" : "";
	const source = document.getElementById(`legal-documents-${languagePart}${licenseRevision}`);
	if (!source) return;
	const json = source.textContent;
	try {
		const html: unknown = JSON.parse(json)[name];
		if (
			typeof html === "string" &&
			html.includes("<h1>") &&
			html.includes("</main>")
		)
			return html;
	} catch {
		// The public link remains available if the embedded document could not be read.
	}
}

export const currentLicenseReadable = () =>
	bundledLegalDocument("license-agreement") !== undefined;

import { licenseRevision } from "./license-receipt";
import { privacyRevision } from "./privacy-revision";

export type LegalDocumentName =
	| "privacy-policy"
	| "license-agreement"
	| "analytics-consent";

export const legalArchivePath = (name: LegalDocumentName) =>
	`/legal/${name === "privacy-policy" ? privacyRevision : licenseRevision}/${name}.html`;

export function bundledLegalDocument(
	name: LegalDocumentName,
): string | undefined {
	if (typeof document === "undefined") return;
	const source = document.getElementById(`legal-documents-${licenseRevision}`);
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

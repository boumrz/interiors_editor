import { licenseRevision } from "../../src/app/license-receipt";
import { createRoot } from "react-dom/client";
import {
	currentLicenseReadable,
} from "../../src/app/legal-release";
import {
	closeActiveLegalDocument,
	LegalDocumentLink,
} from "../../src/ui/LegalDocumentLink";

const root = document.getElementById("root");
if (!root) throw new Error("Missing test root");
createRoot(root).render(
	<main>
		<p data-testid="release">
			{licenseRevision}
		</p>
		<p data-testid="readable">{String(currentLicenseReadable())}</p>
		<input aria-label="Состояние экрана" />
		<LegalDocumentLink documentName="privacy-policy">
			Прочитать политику
		</LegalDocumentLink>
	</main>,
);
window.addEventListener("test-native-back", closeActiveLegalDocument);

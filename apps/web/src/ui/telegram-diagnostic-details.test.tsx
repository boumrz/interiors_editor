import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { createTelegramDiagnostics } from "../app/telegram-diagnostics";
import { TelegramDiagnosticDetails } from "./telegram-diagnostic-details";

it("adds no surface when local diagnostics are absent", () => {
	expect(renderToStaticMarkup(<TelegramDiagnosticDetails />)).toBe("");
});
it("offers a collapsed readable local technical record without automatic transmission", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest: undefined,
		secureContext: true,
		webLocks: true,
	});
	diagnostics.update({
		phase: "verification",
		reason: "invalid-signature",
		capabilities: { indexeddb: true, webgl2: false },
	});
	const html = renderToStaticMarkup(
		<TelegramDiagnosticDetails diagnostics={diagnostics} />,
	);
	expect(html).toContain("Данные для проверки");
	expect(html).toContain("Технические данные для проверки");
	expect(html).toContain("invalid-signature");
	expect(html).toContain("telegram");
	expect(html).toMatch(/<textarea\b[^>]*\breadonly=""/i);
	expect(html).not.toContain("<details open");
	expect(html).not.toContain("<form");
});
it("renders the current owned record after a later technical observation", () => {
	const diagnostics = createTelegramDiagnostics({
		manifest: undefined,
		secureContext: true,
		webLocks: true,
	});
	diagnostics.update({
		phase: "readonly",
		reason: "read-only",
		catalogVersion: "catalog-v2",
	});
	const html = renderToStaticMarkup(
		<TelegramDiagnosticDetails diagnostics={diagnostics} />,
	);
	expect(html).toContain("catalog-v2");
	expect(html).toContain("read-only");
});

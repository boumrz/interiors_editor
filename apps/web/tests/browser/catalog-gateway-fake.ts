import type { Page } from "@playwright/test";
import catalogEnvelope from "../../../catalog-control-plane/src/main/resources/catalog/catalog-envelope-source.json" with {
	type: "json",
};
import resourceFiles from "../../../catalog-control-plane/src/main/resources/catalog/catalog-resource-files-v1.json" with {
	type: "json",
};

/** Browser-only fake. Kotlin/PostgreSQL contract tests remain a separate gate. */
export async function installCatalogGatewayFake(page: Page): Promise<void> {
	const envelopeBody = JSON.stringify(catalogEnvelope);
	const envelopeBytes = new TextEncoder().encode(envelopeBody);
	const envelopeHash = [...new Uint8Array(
		await globalThis.crypto.subtle.digest("SHA-256", envelopeBytes),
	)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
	await page.route("**/catalog-api/v1/catalogs/current", async (route) => {
		await route.fulfill({
			body: envelopeBody,
			contentType: "application/json; charset=utf-8",
			headers: {
				"cache-control": "no-cache, max-age=0, must-revalidate",
				"content-length": String(envelopeBytes.byteLength),
				etag: `"${envelopeHash}"`,
			},
			status: 200,
		});
	});
	await page.route("**/catalog-api/v1/resources/sha256/*", async (route) => {
		const hash = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
		const filename = (resourceFiles as Record<string, string>)[hash];
		if (!filename) {
			await route.fulfill({ status: 404 });
			return;
		}
		const response = await route.fetch({
			headers: { Accept: "*/*" },
			url: new URL(`/catalog/${filename}`, route.request().url()).toString(),
		});
		const body = await response.body();
		await route.fulfill({
			body,
			contentType: filename.endsWith(".png")
				? "image/png"
				: "model/gltf-binary",
			headers: {
				"accept-ranges": "bytes",
				"cache-control": "public, max-age=31536000, immutable",
				"content-length": String(body.byteLength),
				etag: `"${hash}"`,
			},
			status: 200,
		});
	});
}

import { expect, test } from "@playwright/test";

import { installCatalogGatewayFake } from "./catalog-gateway-fake";
import catalogEnvelope from "../../../catalog-control-plane/src/main/resources/catalog/catalog-envelope-source.json" with {
	type: "json",
};

test("catalog browser fake exposes the exact control-plane envelope", async ({
	page,
}) => {
	await installCatalogGatewayFake(page);
	await page.goto("/");
	const response = await page.evaluate(async () => {
		const result = await fetch("/catalog-api/v1/catalogs/current", {
			credentials: "omit",
			headers: { Accept: "application/json" },
		});
		return {
			body: await result.text(),
			contentType: result.headers.get("content-type"),
			etag: result.headers.get("etag"),
			status: result.status,
		};
	});
	expect(response.status).toBe(200);
	expect(response.contentType).toBe("application/json; charset=utf-8");
	expect(response.etag).toMatch(/^"[0-9a-f]{64}"$/);
	expect(JSON.parse(response.body)).toEqual(catalogEnvelope);
});

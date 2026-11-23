import type { BrowserContext } from "@playwright/test";

// Editor regressions start with a returning user. The first-use suite starts empty.
const receipt = {
	name: "interiors:web:license:2026-11-22.2",
	value: "2026-11-22T00:00:00.000Z",
};

export function returningWebUser(baseURL: string) {
	return {
		cookies: [],
		origins: [
			{ origin: new URL(baseURL).origin, localStorage: [receipt] },
		],
	};
}

export async function installReturningWebProfile(context: BrowserContext, baseURL: string | undefined) {
	if (!baseURL) throw new Error("Expected the browser test project to define baseURL");
	const [profile] = returningWebUser(baseURL).origins;
	await context.addInitScript(({ origin, localStorage: items }) => {
		if (location.origin === origin) {
			for (const { name, value } of items) localStorage.setItem(name, value);
		}
	}, profile);
}

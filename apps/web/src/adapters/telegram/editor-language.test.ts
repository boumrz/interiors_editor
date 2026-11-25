import { describe, expect, it } from "@rstest/core";
import { botLanguageKey, languageForTelegram, selectTelegramLanguage } from "./editor-language";

const scope = "tma-v1-test-scope-one";

function memoryStorage() {
	const entries = new Map<string, string>();
	return {
		getItem: (key: string) => entries.get(key) ?? null,
		setItem: (key: string, value: string) => { entries.set(key, value); },
	};
}

async function signChoice(key: CryptoKey, language: "ru" | "en", revision: number) {
	const payload = new TextEncoder().encode(`interiors-language/1\n${scope}\n${language}\n${revision}`);
	const bytes = new Uint8Array(await crypto.subtle.sign("Ed25519", key, payload));
	const signature = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
	return `lang1_${language}_${revision}_${signature}`;
}

describe("Telegram editor language", () => {
	it.each([
		["ru", "en-US", "ru"], ["RU-RU", "en-US", "ru"],
		["en-GB", "ru", "en"], ["de", "ru", "en"],
		[undefined, "ru-RU", "ru"], [undefined, undefined, "en"],
		[" Russian ", "ru", "en"], [" RU-Cyrl-RU ", "en", "ru"],
		["  ", " ru ", "ru"], ["ruI", "en", "en"],
	] as const)("uses Telegram %s then device %s", (telegram, device, expected) => {
		expect(languageForTelegram(telegram, device)).toBe(expected);
	});

	it("uses an account-bound newest bot choice across later launches", async () => {
		const keys = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]) as CryptoKeyPair;
		const storage = memoryStorage();
		const key = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
		const launch = { scope, languageCode: "ru" };
		const dependencies = { storage, key, deviceLanguage: "en" };
		const english = await signChoice(keys.privateKey, "en", 2);
		const russian = await signChoice(keys.privateKey, "ru", 3);
		const sameRevision = await signChoice(keys.privateKey, "en", 3);
		const base64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
		const nonCanonical = english.slice(0, -1) + base64[base64.indexOf(english.slice(-1)) + 1];
		const invalid = [
			english.replace("lang1_", "other_"), `${english}A`, english.slice(0, -1),
			english.replace("_2_", "_02_"), english.replace("_2_", "_9007199254740992_"),
			english.replace("_en_", "_de_"), nonCanonical,
		];
		for (const startParameter of invalid) {
			expect(await selectTelegramLanguage({ ...launch, startParameter }, dependencies)).toBe("ru");
		}
		expect(await selectTelegramLanguage({ ...launch, startParameter: english.replace("_2_", "_3_") }, dependencies)).toBe("ru");
		expect(await selectTelegramLanguage({ ...launch, startParameter: english }, dependencies)).toBe("en");
		expect(await selectTelegramLanguage(launch, dependencies)).toBe("en");
		expect(await selectTelegramLanguage({ ...launch, scope: "tma-v1-test-scope-two", startParameter: english }, dependencies)).toBe("ru");
		expect(await selectTelegramLanguage({ ...launch, startParameter: russian }, dependencies)).toBe("ru");
		expect(await selectTelegramLanguage({ ...launch, startParameter: english }, dependencies)).toBe("ru");
		expect(await selectTelegramLanguage({ ...launch, startParameter: sameRevision }, dependencies)).toBe("ru");
		expect(await selectTelegramLanguage({ ...launch, startParameter: english }, { ...dependencies, storage: undefined })).toBe("en");
		expect(await selectTelegramLanguage({ ...launch, startParameter: english }, { ...dependencies, key: undefined, storage: undefined })).toBe("ru");
		expect(await selectTelegramLanguage({ ...launch, startParameter: english }, {
			...dependencies,
			storage: {
				getItem() { throw Error("blocked storage"); },
				setItem() { throw Error("blocked storage"); },
			},
		})).toBe("en");
	});

	it("ignores unreadable, out-of-range and unsupported cached choices", async () => {
		for (const raw of ["{", "null", "[]", "1", '"en"',
			'{"language":"en"}', '{"revision":1}', '{"language":"en","revision":"1"}',
			'{"language":"en","revision":0}', '{"language":"en","revision":-1}',
			'{"language":"en","revision":1.1}', '{"language":"en","revision":9007199254740992}',
			'{"language":"de","revision":1}',
		]) {
			const storage = memoryStorage();
			storage.setItem(`interiors-tma-language:${scope}`, raw);
			expect(await selectTelegramLanguage({ scope, languageCode: "ru" }, { storage })).toBe("ru");
		}
	});

	it("trusts the configured signing key only for the production bot", () => {
		const key = botLanguageKey("9112733311", "production");
		expect(key).toHaveLength(32);
		expect(key?.slice(0, 4)).toEqual(new Uint8Array([0x3d, 0xf1, 0x96, 0x21]));
		expect(botLanguageKey("9112733311", "test")).toBeUndefined();
		expect(botLanguageKey("9112733310", "production")).toBeUndefined();
	});

	it("accepts the token issued by the Python bot for the same account", async () => {
		const botPublicKey = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
		const key = Uint8Array.from(botPublicKey.match(/../g) ?? [], byte => Number.parseInt(byte, 16));
		const launch = {
			scope: "tma-v1-f49e79774070c78bd7b009a9870b4937a641e95f6b062925b88e7da7ac014664",
			languageCode: "ru",
			startParameter: "lang1_en_3_OBb2b1eaEuYS4XY7ZTwGyeG0RUVEGSFiityH78dCxdw-xcr7tOYFoxkaxOeQNf04MAP5U_CdM3d68IZ6hT3nCA",
		};
		expect(await selectTelegramLanguage(launch, { key })).toBe("en");
	});

	it("accepts only one authentic menu choice for the verified Telegram account", async () => {
		const keys = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]) as CryptoKeyPair;
		const key = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
		const token = await signChoice(keys.privateKey, "en", 2);
		const startParameter = await signChoice(keys.privateKey, "ru", 1);
		const menuSearch = `?language_token=${token}`;
		const launch = { scope, languageCode: "ru" };
		const storage = memoryStorage();
		const dependencies = { key, storage };
		for (const invalid of ["?language_token=en", `?other=${token}`, `${menuSearch}A`, `${menuSearch}&language_token=${token}`, menuSearch.replace("_2_", "_3_")]) {
			expect(await selectTelegramLanguage(launch, { ...dependencies, menuSearch: invalid })).toBe("ru");
		}
		expect(await selectTelegramLanguage({ ...launch, scope: `${scope}-other` }, { ...dependencies, menuSearch })).toBe("ru");
		expect(await selectTelegramLanguage({ ...launch, startParameter }, { ...dependencies, menuSearch })).toBe("ru");
		expect(await selectTelegramLanguage(launch, { ...dependencies, menuSearch })).toBe("en");
		expect(await selectTelegramLanguage(launch, dependencies)).toBe("en");
		storage.setItem(`interiors-tma-language:${scope}`, JSON.stringify({ language: "ru", revision: 3 }));
		expect(await selectTelegramLanguage(launch, { ...dependencies, menuSearch })).toBe("ru");
	});
});

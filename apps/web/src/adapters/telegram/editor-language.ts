import type { EditorLanguage } from "../../ui/editor-language";

type LanguageChoice = { readonly language: EditorLanguage; readonly revision: number };

export function languageForTelegram(telegramLanguage?: string, deviceLanguage?: string): EditorLanguage {
	return /^ru(?:-|$)/i.test(telegramLanguage?.trim() || deviceLanguage?.trim() || "") ? "ru" : "en";
}

function parseChoice(language: unknown, revision: unknown): LanguageChoice | undefined {
	if ((language === "ru" || language === "en") && typeof revision === "number" && Number.isSafeInteger(revision) && revision > 0) {
		return { language, revision };
	}
}

export const botLanguageParameter = /^lang1_(ru|en)_([1-9][0-9]{0,15})_([A-Za-z0-9_-]{86})$/;

export function botLanguageKey(botId: string, environment: string): Uint8Array<ArrayBuffer> | undefined {
	if (botId !== "9112733311" || environment !== "production") return undefined;
	const publicKey = "3df19621f0bb3e3e10d8983eb76ce7288e8cf4a9c50ad774b5f76d170112c536";
	return Uint8Array.from(publicKey.match(/../g) ?? [], byte => Number.parseInt(byte, 16));
}

async function verifiedChoice(parameter: string, scope: string, key: Uint8Array<ArrayBuffer>): Promise<LanguageChoice | undefined> {
	const match = botLanguageParameter.exec(parameter);
	if (!match) return undefined;
	const choice = parseChoice(match[1], Number(match[2]));
	if (!choice) return undefined;
	try {
		const encoded = match[3].replaceAll("-", "+").replaceAll("_", "/") + "==";
		const decoded = atob(encoded);
		if (btoa(decoded) !== encoded) return undefined;
		const signature = Uint8Array.from(decoded, value => value.charCodeAt(0));
		const payload = new TextEncoder().encode(`interiors-language/1\n${scope}\n${choice.language}\n${choice.revision}`);
		const publicKey = await crypto.subtle.importKey("raw", key, "Ed25519", false, ["verify"]);
		return await crypto.subtle.verify("Ed25519", publicKey, signature, payload) ? choice : undefined;
	} catch {
		return undefined;
	}
}

export async function selectTelegramLanguage(
	launch: { readonly scope: string; readonly languageCode?: string; readonly startParameter?: string },
	dependencies: {
		readonly storage?: Pick<Storage, "getItem" | "setItem"> | undefined;
		readonly key?: Uint8Array<ArrayBuffer> | undefined;
		readonly deviceLanguage?: string;
	},
): Promise<EditorLanguage> {
	const storageKey = `interiors-tma-language:${launch.scope}`;
	const candidate = launch.startParameter && dependencies.key
		? await verifiedChoice(launch.startParameter, launch.scope, dependencies.key)
		: undefined;
	let stored: LanguageChoice | undefined;
	try {
		const raw = dependencies.storage?.getItem(storageKey);
		if (raw) {
			const parsed: unknown = JSON.parse(raw);
			if (parsed && typeof parsed === "object" && "language" in parsed && "revision" in parsed) {
				stored = parseChoice(parsed.language, parsed.revision);
			}
		}
	} catch {
		/* Preferences are optional in restricted WebViews. */
	}
	if (candidate && candidate.revision > (stored?.revision ?? 0)) {
		try {
			dependencies.storage?.setItem(storageKey, JSON.stringify(candidate));
		} catch {
			/* A confirmed choice still applies to this launch. */
		}
		return candidate.language;
	}
	return stored?.language ?? languageForTelegram(launch.languageCode, dependencies.deviceLanguage);
}

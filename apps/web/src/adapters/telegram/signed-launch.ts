import { parsePpjA1JsonBytes } from "../../domain/ppj-a1-lossless-json";

export type TelegramEnvironment = "production" | "test";

export type TelegramLaunchConfiguration = {
	readonly botId: string;
	readonly environment: TelegramEnvironment;
};

declare const verifiedScope: unique symbol;
export type VerifiedTelegramScope = string & {
	readonly [verifiedScope]: true;
};

type LaunchRejection =
	| "invalid-configuration"
	| "malformed-init-data"
	| "invalid-identity"
	| "invalid-clock"
	| "expired-launch"
	| "invalid-signature"
	| "unsupported-crypto";

export type TelegramLaunchResult =
	| { readonly kind: "verified"; readonly scope: VerifiedTelegramScope }
	| { readonly kind: "rejected"; readonly reason: LaunchRejection };

type LaunchCrypto = Pick<SubtleCrypto, "digest" | "importKey" | "verify">;

// Official keys: https://core.telegram.org/bots/webapps#validating-data-for-third-party-use
const publicKeys: Readonly<Record<TelegramEnvironment, string>> = {
	production:
		"e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d",
	test: "40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec",
};

/** Local bootstrap only: no storage, host calls, network, token or identity logs. */
export async function verifyTelegramLaunch(
	rawInitData: string,
	configuration: TelegramLaunchConfiguration,
	dependencies: {
		readonly nowEpochMs: number;
		readonly subtle?: LaunchCrypto;
	},
): Promise<TelegramLaunchResult> {
	const { botId, environment } = configuration;
	if (
		!isCanonicalPositiveInteger(botId) ||
		(environment !== "production" && environment !== "test")
	) {
		return reject("invalid-configuration");
	}
	const fields = decodeFields(rawInitData);
	if (!fields) return reject("malformed-init-data");
	const rawUser = fields.get("user");
	const rawAuthDate = fields.get("auth_date");
	const signature = decodeSignature(fields.get("signature"));
	if (!rawUser || !rawAuthDate || !signature) {
		return reject("malformed-init-data");
	}
	// Reuse the bounded, duplicate-aware raw JSON parser, not the PPJ schema.
	// Retaining the ID lexeme prevents fractional/unsafe values rounding to an ID.
	const user = parsePpjA1JsonBytes(new TextEncoder().encode(rawUser));
	const id =
		user.kind === "accepted" && user.root.kind === "object"
			? user.root.properties.get("id")
			: undefined;
	if (id?.kind !== "number" || !isCanonicalPositiveInteger(id.lexeme)) {
		return reject("invalid-identity");
	}
	if (!isCanonicalPositiveInteger(rawAuthDate)) {
		return reject("malformed-init-data");
	}
	const now = dependencies.nowEpochMs;
	if (!Number.isSafeInteger(now) || now < 0) return reject("invalid-clock");
	const ageSeconds = now / 1_000 - Number(rawAuthDate);
	if (ageSeconds > 300 || ageSeconds < -60) return reject("expired-launch");

	const signedFields = [...fields.keys()]
		.filter((key) => key !== "hash" && key !== "signature")
		.sort()
		.map((key) => `${key}=${fields.get(key)}`)
		.join("\n");
	const signedData = `${botId}:WebAppData\n${signedFields}`;
	try {
		const subtle = dependencies.subtle ?? globalThis.crypto.subtle;
		const key = await subtle.importKey(
			"raw",
			Uint8Array.from(publicKeys[environment].match(/../g) ?? [], (value) =>
				Number.parseInt(value, 16),
			),
			"Ed25519",
			false,
			["verify"],
		);
		if (
			!(await subtle.verify(
				"Ed25519",
				key,
				signature,
				new TextEncoder().encode(signedData),
			))
		) {
			return reject("invalid-signature");
		}
		const digest = await subtle.digest(
			"SHA-256",
			new TextEncoder().encode(`tma-v1:${environment}:${botId}:${id.lexeme}`),
		);
		const hex = Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
		if (hex.length !== 64) return reject("unsupported-crypto");
		return {
			kind: "verified",
			scope: `tma-v1-${hex}` as VerifiedTelegramScope,
		};
	} catch {
		return reject("unsupported-crypto");
	}
}

function isCanonicalPositiveInteger(value: string): boolean {
	return /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value));
}

function decodeFields(raw: string): ReadonlyMap<string, string> | undefined {
	// A bootstrap is small. Bound untrusted work before splitting/JSON parsing.
	if (
		!raw ||
		raw.length > 65_536 ||
		/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
			raw,
		)
	)
		return undefined;
	const fields = new Map<string, string>();
	try {
		for (const pair of raw.split("&")) {
			const separator = pair.indexOf("=");
			if (separator < 1) return undefined;
			const decode = (value: string) =>
				decodeURIComponent(value.replace(/\+/g, " "));
			const key = decode(pair.slice(0, separator));
			const value = decode(pair.slice(separator + 1));
			if (
				!/^[A-Za-z0-9_]+$/.test(key) ||
				/[\r\n]/.test(value) ||
				fields.has(key)
			) {
				return undefined;
			}
			fields.set(key, value);
		}
		return fields;
	} catch {
		return undefined;
	}
}

function decodeSignature(
	value: string | undefined,
): Uint8Array<ArrayBuffer> | undefined {
	if (!value || !/^[A-Za-z0-9_-]{86}(?:==)?$/.test(value)) return undefined;
	try {
		const encoded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(88, "=");
		const decoded = atob(encoded);
		if (decoded.length !== 64 || btoa(decoded) !== encoded) return undefined;
		return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
	} catch {
		return undefined;
	}
}

function reject(reason: LaunchRejection): TelegramLaunchResult {
	return { kind: "rejected", reason };
}

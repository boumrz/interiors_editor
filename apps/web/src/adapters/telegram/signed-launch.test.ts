import { describe, expect, it } from "@rstest/core";
import { verifyTelegramLaunch } from "./signed-launch";

// Published Telegram-signed known answer from the tma.js maintainers:
// https://github.com/Telegram-Mini-Apps/tma.js/blob/master/apps/docs/platform/init-data.md
// The protocol and production public key are from core.telegram.org/bots/webapps.
// This is public test data, never a live login or a configured application bot.
const signedExample =
	"user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladislav%20%2B%20-%20%3F%20%5C%2F%22%2C%22last_name%22%3A%22Kibenko%22%2C%22username%22%3A%22vdkfrost%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F4FPEE4tmP3ATHa57u6MqTDih13LTOiMoKoLDRG4PnSA.svg%22%7D&chat_instance=8134722200314281151&chat_type=private&auth_date=1733584787&hash=2174df5b000556d044f3f020384e879c8efcab55ddea2ced4eb752e93e7080d6&signature=zL-ucjNyREiHDE8aihFwpfR9aggP2xiAo3NSpfe-p7IbCisNlDKlo7Kb6G4D0Ao2mBrSgEk4maLSdv6MLIlADQ";
const configuration = {
	botId: "7342037359",
	environment: "production",
} as const;
const nowEpochMs = 1_733_584_787_000;

describe("signed Telegram bootstrap", () => {
	it("verifies the published signature with the real Telegram key and derives the exact local scope", async () => {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode("tma-v1:production:7342037359:279058397"),
		);
		const expectedScope = `tma-v1-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
		expect(
			await verifyTelegramLaunch(signedExample, configuration, { nowEpochMs }),
		).toEqual({ kind: "verified", scope: expectedScope, authenticatedAt: 1733584787, languageCode: "ru" });
	});

	it("accepts reordered pairs, equivalent single query decoding, optional hash and base64url padding", async () => {
		const pairs = signedExample.split("&").reverse();
		const reordered = pairs
			.join("&")
			.replace("Vladislav%20%2B", "Vladislav+%2B");
		for (const raw of [
			reordered,
			setField("hash", "ignored-hmac"),
			withoutField("hash"),
			setField(
				"signature",
				`${new URLSearchParams(signedExample).get("signature")}==`,
			),
		]) {
			expect(
				await verifyTelegramLaunch(raw, configuration, { nowEpochMs }),
			).toMatchObject({ kind: "verified" });
		}
	});

	it("checks the configured bot, environment, all signed fields and signature with native Ed25519", async () => {
		for (const [raw, config] of [
			[signedExample, { ...configuration, botId: "7342037360" }],
			[signedExample, { ...configuration, environment: "test" as const }],
			[setField("chat_type", "group"), configuration],
			[`${signedExample}&unknown_signed_field=extra`, configuration],
			[`${signedExample}&a=1`, configuration],
			[`${signedExample}&extra=😀`, configuration],
			[setField("signature", "A".repeat(86)), configuration],
			[
				setField("signature", `${"A".repeat(4)}_${"A".repeat(81)}`),
				configuration,
			],
		] as const) {
			expect(await verifyTelegramLaunch(raw, config, { nowEpochMs })).toEqual({
				kind: "rejected",
				reason: "invalid-signature",
			});
		}
	});

	it("allows the exact freshness boundaries, but never disables or extends them", async () => {
		for (const offsetSeconds of [-60, 0, 300]) {
			expect(
				await verifyTelegramLaunch(signedExample, configuration, {
					nowEpochMs: nowEpochMs + offsetSeconds * 1_000,
				}),
			).toMatchObject({ kind: "verified" });
		}
		for (const offsetMs of [-60_001, 300_001]) {
			expect(
				await verifyTelegramLaunch(signedExample, configuration, {
					nowEpochMs: nowEpochMs + offsetMs,
				}),
			).toEqual({ kind: "rejected", reason: "expired-launch" });
		}
	});

	it("rejects invalid local clocks and noncanonical trusted configuration", async () => {
		expect(
			await verifyTelegramLaunch(signedExample, configuration, {
				nowEpochMs: 0,
			}),
		).toEqual({ kind: "rejected", reason: "expired-launch" });
		for (const now of [
			Number.NaN,
			Number.POSITIVE_INFINITY,
			-1,
			0.5,
			Number.MAX_SAFE_INTEGER + 1,
		]) {
			expect(
				await verifyTelegramLaunch(signedExample, configuration, {
					nowEpochMs: now,
				}),
			).toEqual({ kind: "rejected", reason: "invalid-clock" });
		}
		for (const botId of [
			"",
			"0",
			"-1",
			"07342037359",
			"7e9",
			"1.1",
			"9007199254740992",
		]) {
			expect(
				await verifyTelegramLaunch(
					signedExample,
					{ ...configuration, botId },
					{ nowEpochMs },
				),
			).toEqual({ kind: "rejected", reason: "invalid-configuration" });
		}
		expect(
			await verifyTelegramLaunch(
				signedExample,
				{
					...configuration,
					environment: "staging" as "test",
				},
				{ nowEpochMs },
			),
		).toEqual({ kind: "rejected", reason: "invalid-configuration" });
	});

	it("rejects malformed query encoding, duplicate decoded names and field injection", async () => {
		for (const raw of [
			"",
			"x".repeat(65_537),
			"&",
			`${signedExample}&`,
			`${signedExample}&empty`,
			`${signedExample}&=value`,
			`${signedExample}&user=another`,
			`${signedExample}&%75ser=another`,
			`${signedExample}&%61uth_date=1`,
			`${signedExample}&signature=another`,
			`${signedExample}&hash=another`,
			`${signedExample}&extra=%`,
			`${signedExample}&extra=%0`,
			`${signedExample}&extra=%GG`,
			`${signedExample}&extra=%C3%28`,
			`${signedExample}&extra=%C0%AF`,
			`${signedExample}&extra=%ED%A0%80`,
			`${signedExample}&extra=\ud800`,
			`${signedExample}&extra=\udc00`,
			`${signedExample}&bad%0Akey=value`,
			`${signedExample}&extra=line%0Abreak`,
			`${signedExample}&extra=line%0Dbreak`,
			`${signedExample}&a%3Db=value`,
		]) {
			expect(
				await verifyTelegramLaunch(raw, configuration, { nowEpochMs }),
			).toEqual({ kind: "rejected", reason: "malformed-init-data" });
		}
	});

	it("bounds a structurally valid launch before crypto, with an inclusive maximum", async () => {
		const prefix = `${signedExample}&extra=`;
		const atLimit = prefix + "x".repeat(65_536 - prefix.length);
		expect(
			await verifyTelegramLaunch(atLimit, configuration, { nowEpochMs }),
		).toEqual({ kind: "rejected", reason: "invalid-signature" });
		expect(
			await verifyTelegramLaunch(`${atLimit}x`, configuration, { nowEpochMs }),
		).toEqual({ kind: "rejected", reason: "malformed-init-data" });
	});

	it("requires a correctly encoded signature, signed user and auth date", async () => {
		for (const name of ["user", "auth_date", "signature"]) {
			for (const raw of [withoutField(name), setField(name, "")]) {
				expect(
					await verifyTelegramLaunch(raw, configuration, { nowEpochMs }),
				).toEqual({ kind: "rejected", reason: "malformed-init-data" });
			}
		}
		for (const value of [
			"A".repeat(85),
			"A".repeat(87),
			`${"A".repeat(86)}=`,
			`${"A".repeat(84)}+/`,
			`${"A".repeat(85)}B`,
		]) {
			expect(
				await verifyTelegramLaunch(
					setField("signature", value),
					configuration,
					{ nowEpochMs },
				),
			).toEqual({ kind: "rejected", reason: "malformed-init-data" });
		}
		for (const authDate of [
			"0",
			"-1",
			"01733584787",
			"1733584787.0",
			"1e9",
			"NaN",
			"9007199254740992",
		]) {
			expect(
				await verifyTelegramLaunch(
					setField("auth_date", authDate),
					configuration,
					{ nowEpochMs },
				),
			).toEqual({ kind: "rejected", reason: "malformed-init-data" });
		}
	});

	it("rejects duplicate user JSON members and IDs that could round to a safe integer", async () => {
		for (const user of [
			"null",
			"[]",
			'"user"',
			"{}",
			'{"id":"279058397"}',
			'{"id":0}',
			'{"id":-1}',
			'{"id":1.0}',
			'{"id":1e2}',
			'{"id":9007199254740992}',
			'{"id":9007199254740991.1}',
			'{"id":279058397,"id":279058398}',
			'{"id":279058397,"\\u0069d":279058398}',
			'{"id":279058397,"extra":{"x":1,"x":2}}',
			'{"id":279058397} trailing',
		]) {
			expect(
				await verifyTelegramLaunch(setField("user", user), configuration, {
					nowEpochMs,
				}),
			).toEqual({ kind: "rejected", reason: "invalid-identity" });
		}
		const user = new URLSearchParams(signedExample).get("user");
		expect(
			await verifyTelegramLaunch(
				setField("user", encodeURIComponent(user ?? "")),
				configuration,
				{ nowEpochMs },
			),
		).toEqual({ kind: "rejected", reason: "invalid-identity" });
	});

	it("fails closed when Ed25519 import/verification or SHA-256 is unsupported", async () => {
		const native = crypto.subtle;
		const supported = {
			importKey: native.importKey.bind(native),
			verify: native.verify.bind(native),
			digest: native.digest.bind(native),
		};
		const unsupported = async (): Promise<never> => {
			throw new Error("unsupported");
		};
		for (const subtle of [
			{ ...supported, importKey: unsupported },
			{ ...supported, verify: unsupported },
			{ ...supported, digest: unsupported },
			{ ...supported, digest: async () => new ArrayBuffer(0) },
		]) {
			expect(
				await verifyTelegramLaunch(signedExample, configuration, {
					nowEpochMs,
					subtle,
				}),
			).toEqual({ kind: "rejected", reason: "unsupported-crypto" });
		}
	});

	it("binds the signature and resulting scope to one configuration snapshot across crypto awaits", async () => {
		const mutableConfiguration = {
			botId: "7342037359",
			environment: "production" as "production" | "test",
		};
		const native = crypto.subtle;
		const original = await verifyTelegramLaunch(signedExample, configuration, {
			nowEpochMs,
		});
		const result = await verifyTelegramLaunch(
			signedExample,
			mutableConfiguration,
			{
				nowEpochMs,
				subtle: {
					importKey: native.importKey.bind(native),
					digest: native.digest.bind(native),
					verify: async (...arguments_: Parameters<SubtleCrypto["verify"]>) => {
						const verified = await native.verify(...arguments_);
						mutableConfiguration.botId = "7342037360";
						mutableConfiguration.environment = "test";
						return verified;
					},
				},
			},
		);
		expect(result).toEqual(original);
	});
});

function setField(name: string, value: string): string {
	const fields = new URLSearchParams(signedExample);
	fields.set(name, value);
	return fields.toString();
}

function withoutField(name: string): string {
	const fields = new URLSearchParams(signedExample);
	fields.delete(name);
	return fields.toString();
}

it("accepts known signed launch parameters without exposing a dedicated analytics or test mode", async () => {
	const native = crypto.subtle;
	const keys = (await native.generateKey({ name: "Ed25519" }, false, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
	const subtle = {
		importKey: async () => keys.publicKey,
		verify: native.verify.bind(native),
		digest: native.digest.bind(native),
	};
	for (const value of [
		"metrica_check",
		"metrica_check_other",
		"",
		"METRICA_CHECK",
		`lang1_en_1_${"A".repeat(86)}`,
	]) {
		const fields = new URLSearchParams(signedExample);
		fields.set("start_param", value);
		const payload = [...fields.entries()]
			.filter(([key]) => key !== "hash" && key !== "signature")
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.map(([key, v]) => `${key}=${v}`)
			.join("\n");
		const sig = await native.sign(
			{ name: "Ed25519" },
			keys.privateKey,
			new TextEncoder().encode(`${configuration.botId}:WebAppData\n${payload}`),
		);
		fields.set(
			"signature",
			btoa(String.fromCharCode(...new Uint8Array(sig)))
				.replaceAll("+", "-")
				.replaceAll("/", "_")
				.replace(/=+$/, ""),
		);
		const result = await verifyTelegramLaunch(
			fields.toString(),
			configuration,
			{ nowEpochMs, subtle },
		);
		expect(result.kind).toBe("verified");
		expect("measurementCheck" in result).toBe(false);
		if (value.startsWith("lang1_")) expect(result).toMatchObject({ startParameter: value });
	}
	const modified = await verifyTelegramLaunch(
		`${signedExample}&start_param=metrica_check`,
		configuration,
		{ nowEpochMs },
	);
	expect(modified).toEqual({ kind: "rejected", reason: "invalid-signature" });
});

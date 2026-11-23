export type AnalyticsDocument = {
	readonly documentURL: string;
	readonly counterId: number;
	readonly testLaunchOnly?: true;
};

export function safeAnalyticsURL(value: unknown): URL | undefined {
	if (typeof value !== "string") return;
	try {
		const url = new URL(value);
		if (url.href !== value || value !== url.origin + url.pathname) return;
		if (
			url.protocol === "https:" ||
			(url.protocol === "http:" && url.hostname === "127.0.0.1")
		)
			return url;
	} catch {
		// Optional deployment configuration must never prevent editor startup.
	}
}

export function exactRecord(
	value: unknown,
	keys: readonly string[],
): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value).length === keys.length &&
		keys.every((key) => Object.hasOwn(value, key))
	);
}

export function analyticsForVerifiedLaunch(
	config: AnalyticsDocument | undefined,
	measurementCheck: true | undefined,
) {
	return config?.testLaunchOnly && !measurementCheck ? undefined : config;
}

export function isCounterId(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseAnalyticsDocument(
	value: unknown,
	editorOrigin: string,
): AnalyticsDocument | undefined {
	const controlled =
		exactRecord(value, ["documentURL", "counterId", "testLaunchOnly"]) &&
		value.testLaunchOnly === true;
	if (!controlled && !exactRecord(value, ["documentURL", "counterId"])) return;
	const url = safeAnalyticsURL(value.documentURL);
	if (
		!url ||
		url.origin === editorOrigin ||
		!/\/launch-v1\.[0-9a-f]{64}\.html$/.test(url.pathname) ||
		!isCounterId(value.counterId)
	)
		return;
	if (url.protocol === "http:" && !editorOrigin.startsWith("http://127.0.0.1:"))
		return;
	return {
		documentURL: url.href,
		counterId: value.counterId,
		...(controlled ? { testLaunchOnly: true } : {}),
	};
}

const types = [
	"connect",
	"ready",
	"activate",
	"online",
	"launch",
	"accepted",
	"failed",
] as const;
type MessageType = (typeof types)[number];
export const generationPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function channelMessage(
	type: MessageType,
	token: string,
	counterId: number,
) {
	return { v: 1, type, token, counterId } as const;
}
export function readChannelMessage(
	value: unknown,
	counter: number,
): ReturnType<typeof channelMessage> | undefined {
	if (!exactRecord(value, ["v", "type", "token", "counterId"])) return;
	const record = value;
	const type = types.find((candidate) => candidate === record.type);
	if (
		type &&
		record.v === 1 &&
		record.counterId === counter &&
		typeof record.token === "string" &&
		generationPattern.test(record.token)
	)
		return channelMessage(type, record.token, counter);
}

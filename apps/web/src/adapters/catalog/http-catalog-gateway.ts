import type {
	BinaryChecksumPort,
	CatalogGatewayPort,
	CatalogPublicationResult,
	CatalogRequestSignalPort,
	CatalogResourceDescriptor,
	CatalogResourceMediaType,
	CatalogResourceResult,
	VersionedCatalogAsset,
	VersionedCatalogPublication,
	VersionedCatalogVariant,
	VersionedCatalogVariantSlot,
} from "../../application/ports";
import { validateCatalogMedia } from "./catalog-media-validator";

const MAXIMUM_ENVELOPE_BYTES = 262_144;
const DEFAULT_PUBLICATION_REQUEST_TIMEOUT_MILLISECONDS = 15_000;
const DEFAULT_RESOURCE_REQUEST_TIMEOUT_MILLISECONDS = 15_000;
const identifierPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const versionPattern = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;
const hashPattern = /^[0-9a-f]{64}$/;
const timestampPattern =
	/^[2-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9](?:\.[0-9]{1,6})?Z$/;
const catalogSections = new Set([
	"accessories",
	"appliances-electronics",
	"furniture",
	"lighting",
	"plumbing",
]);
const catalogCategories = new Set([
	"accessory",
	"appliance",
	"electronics",
	"lighting",
	"plumbing",
	"seating",
	"sleep",
	"storage",
	"tables",
]);

type JsonObject = Record<string, unknown>;

export interface HttpCatalogGatewayDependencies {
	readonly checksum: BinaryChecksumPort;
	readonly fetcher?: typeof fetch;
	/** Catalog browsing leaves loading with a retryable error after this deadline. */
	readonly publicationRequestTimeoutMilliseconds?: number;
	/** A selected model must leave loading for retryable unavailability on timeout. */
	readonly resourceRequestTimeoutMilliseconds?: number;
}

export class HttpCatalogGateway implements CatalogGatewayPort {
	private readonly fetcher: typeof fetch;
	private readonly publicationRequestTimeoutMilliseconds: number;
	private readonly resourceRequestTimeoutMilliseconds: number;

	public constructor(
		private readonly dependencies: HttpCatalogGatewayDependencies,
	) {
		this.fetcher = dependencies.fetcher ?? globalThis.fetch.bind(globalThis);
		this.publicationRequestTimeoutMilliseconds =
			dependencies.publicationRequestTimeoutMilliseconds ??
			DEFAULT_PUBLICATION_REQUEST_TIMEOUT_MILLISECONDS;
		this.resourceRequestTimeoutMilliseconds =
			dependencies.resourceRequestTimeoutMilliseconds ??
			DEFAULT_RESOURCE_REQUEST_TIMEOUT_MILLISECONDS;
	}

	public async currentPublication(
		signal?: CatalogRequestSignalPort,
	): Promise<CatalogPublicationResult> {
		if (signal?.aborted) return { kind: "cancelled" };
		const requestController = new AbortController();
		const abortFromCaller = () => requestController.abort();
		signal?.addEventListener("abort", abortFromCaller, { once: true });
		const timeout = globalThis.setTimeout(() => {
			requestController.abort();
		}, this.publicationRequestTimeoutMilliseconds);
		try {
			const response = await this.fetcher("/catalog-api/v1/catalogs/current", {
				cache: "no-store",
				credentials: "omit",
				headers: { Accept: "application/json" },
				method: "GET",
				redirect: "error",
				signal: requestController.signal,
			});
			if (!response.ok) return { kind: "unavailable" };
			const contentType = response.headers
				.get("content-type")
				?.split(";", 1)[0]
				?.trim()
				.toLowerCase();
			const envelopeHash = envelopeHashFromEtag(response.headers.get("etag"));
			if (contentType !== "application/json" || envelopeHash === undefined) {
				return invalidEnvelope();
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			const contentLengthHeader = response.headers.get("content-length");
			if (
				bytes.byteLength === 0 ||
				bytes.byteLength > MAXIMUM_ENVELOPE_BYTES ||
				(contentLengthHeader !== null &&
					exactContentLength(contentLengthHeader) !== bytes.byteLength) ||
				(await this.dependencies.checksum.sha256Bytes(bytes)) !==
					envelopeHash ||
				(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
			) {
				return invalidEnvelope();
			}
			const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
			const publication = decodePublication(JSON.parse(text), envelopeHash);
			return { kind: "available", publication };
		} catch (failure) {
			if (signal?.aborted) return { kind: "cancelled" };
			if (failure instanceof CatalogEnvelopeError) return invalidEnvelope();
			return { kind: "unavailable" };
		} finally {
			globalThis.clearTimeout(timeout);
			signal?.removeEventListener("abort", abortFromCaller);
		}
	}

	public async resource(
		descriptor: CatalogResourceDescriptor,
		signal?: CatalogRequestSignalPort,
	): Promise<CatalogResourceResult> {
		if (signal?.aborted) return { kind: "cancelled" };
		const requestController = new AbortController();
		const abortFromCaller = () => requestController.abort();
		signal?.addEventListener("abort", abortFromCaller, { once: true });
		const timeout = globalThis.setTimeout(() => {
			requestController.abort();
		}, this.resourceRequestTimeoutMilliseconds);
		try {
			const response = await this.fetcher(
				catalogResourceUrl(descriptor.sha256),
				{
					cache: "no-store",
					credentials: "omit",
					headers: { Accept: descriptor.mediaType },
					method: "GET",
					redirect: "error",
					signal: requestController.signal,
				},
			);
			if (!response.ok) return { kind: "unavailable" };
			const contentType = response.headers
				.get("content-type")
				?.split(";", 1)[0]
				?.trim()
				.toLowerCase();
			const contentLengthHeader = response.headers.get("content-length");
			if (
				contentType !== descriptor.mediaType ||
				(contentLengthHeader !== null &&
					exactContentLength(contentLengthHeader) !== descriptor.byteLength) ||
				response.headers.get("etag") !== `"${descriptor.sha256}"` ||
				response.headers.get("accept-ranges") !== "bytes" ||
				response.headers.has("content-encoding")
			) {
				return { kind: "integrity-failed" };
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			if (
				bytes.byteLength !== descriptor.byteLength ||
				(await this.dependencies.checksum.sha256Bytes(bytes)) !==
					descriptor.sha256 ||
				validateCatalogMedia(descriptor.mediaType, bytes).kind === "rejected"
			) {
				return { kind: "integrity-failed" };
			}
			return { bytes, kind: "available", resourceHash: descriptor.sha256 };
		} catch {
			if (signal?.aborted) return { kind: "cancelled" };
			return { kind: "unavailable" };
		} finally {
			globalThis.clearTimeout(timeout);
			signal?.removeEventListener("abort", abortFromCaller);
		}
	}
}

function exactContentLength(value: string | null): number | undefined {
	if (!value?.match(/^(?:0|[1-9][0-9]*)$/)) return undefined;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/**
 * A proxy may legitimately mark an otherwise byte-identical SHA-256 ETag as
 * weak. The digest over the response bytes is still verified below, so the
 * weak marker does not relax the catalog integrity boundary.
 */
function envelopeHashFromEtag(value: string | null): string | undefined {
	return value?.match(/^(?:W\/)?"([0-9a-f]{64})"$/)?.[1];
}

export function catalogResourceUrl(hash: string): string {
	return `/catalog-api/v1/resources/sha256/${hash}`;
}

function invalidEnvelope(): CatalogPublicationResult {
	return {
		kind: "invalid-envelope",
		reasonCode: "CATALOG_ENVELOPE_SCHEMA_INVALID",
	};
}

class CatalogEnvelopeError extends Error {}

function rejectEnvelope(): never {
	throw new CatalogEnvelopeError("CATALOG_ENVELOPE_SCHEMA_INVALID");
}

function decodePublication(
	value: unknown,
	envelopeHash: string,
): VersionedCatalogPublication {
	const root = exactObject(value, [
		"assets",
		"catalogVersion",
		"publishedAt",
		"schemaVersion",
	]);
	if (root.schemaVersion !== 1) rejectEnvelope();
	const catalogVersion = exactString(root.catalogVersion);
	if (!versionPattern.test(catalogVersion) || catalogVersion === "current") {
		rejectEnvelope();
	}
	const publishedAt = exactString(root.publishedAt);
	if (!isExactUtcTimestamp(publishedAt)) {
		rejectEnvelope();
	}
	if (
		!Array.isArray(root.assets) ||
		root.assets.length < 1 ||
		root.assets.length > 256
	) {
		rejectEnvelope();
	}
	const descriptors = new Map<string, CatalogResourceDescriptor>();
	const assets = root.assets.map((asset) => decodeAsset(asset, descriptors));
	requireSortedUnique(assets.map(({ assetId }) => assetId));
	return { assets, catalogVersion, envelopeHash, publishedAt };
}

function isExactUtcTimestamp(value: string): boolean {
	if (!timestampPattern.test(value)) return false;
	const match = value.match(
		/^([2-9][0-9]{3})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-5][0-9])(?:\.[0-9]{1,6})?Z$/,
	);
	if (!match) return false;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return false;
	return (
		parsed.getUTCFullYear() === Number(match[1]) &&
		parsed.getUTCMonth() + 1 === Number(match[2]) &&
		parsed.getUTCDate() === Number(match[3]) &&
		parsed.getUTCHours() === Number(match[4]) &&
		parsed.getUTCMinutes() === Number(match[5]) &&
		parsed.getUTCSeconds() === Number(match[6])
	);
}

function decodeAsset(
	value: unknown,
	descriptors: Map<string, CatalogResourceDescriptor>,
): VersionedCatalogAsset {
	const asset = exactObject(
		value,
		[
			"anchorClass",
			"assetId",
			"category",
			"dimensionsMm",
			"footprintMm",
			"frontDirection",
			"label",
			"resource",
			"section",
			"thumbnail",
			"variantSlots",
		],
		["thumbnail"],
	);
	const assetId = exactIdentifier(asset.assetId);
	const label = exactLabel(asset.label);
	const section = exactString(asset.section);
	if (!catalogSections.has(section)) rejectEnvelope();
	const category = exactString(asset.category);
	if (!catalogCategories.has(category)) rejectEnvelope();
	const anchorClass = exactString(asset.anchorClass);
	if (anchorClass !== "floor" && anchorClass !== "wall") rejectEnvelope();
	if (asset.frontDirection !== "positive-z") rejectEnvelope();
	const dimensions = exactDimensions(asset.dimensionsMm);
	const footprint = exactObject(asset.footprintMm, ["depth", "kind", "width"]);
	if (
		footprint.kind !== "rectangle" ||
		exactPositiveInteger(footprint.width, 100_000) !== dimensions.width ||
		exactPositiveInteger(footprint.depth, 100_000) !== dimensions.depth
	) {
		rejectEnvelope();
	}
	const resource = exactResource(
		asset.resource,
		"model/gltf-binary",
		26_214_400,
		descriptors,
	);
	const thumbnail =
		asset.thumbnail === undefined
			? undefined
			: exactResource(asset.thumbnail, "image/png", 262_144, descriptors);
	if (!Array.isArray(asset.variantSlots) || asset.variantSlots.length > 1) {
		rejectEnvelope();
	}
	const variantSlots = asset.variantSlots.map((slot) =>
		decodeVariantSlot(slot, descriptors),
	);
	return {
		anchorClass,
		assetId,
		category: category as VersionedCatalogAsset["category"],
		dimensionsMm: dimensions,
		frontDirection: "positive-z",
		label,
		resource,
		section: section as VersionedCatalogAsset["section"],
		...(thumbnail ? { thumbnail } : {}),
		variantSlots,
	};
}

function decodeVariantSlot(
	value: unknown,
	descriptors: Map<string, CatalogResourceDescriptor>,
): VersionedCatalogVariantSlot {
	const slot = exactObject(value, ["kind", "label", "slotId", "variants"]);
	if (slot.kind !== "model-resource") rejectEnvelope();
	if (
		!Array.isArray(slot.variants) ||
		slot.variants.length < 1 ||
		slot.variants.length > 32
	) {
		rejectEnvelope();
	}
	const variants = slot.variants.map((variant) =>
		decodeVariant(variant, descriptors),
	);
	requireSortedUnique(variants.map(({ variantId }) => variantId));
	return {
		kind: "model-resource",
		label: exactLabel(slot.label),
		slotId: exactIdentifier(slot.slotId),
		variants,
	};
}

function decodeVariant(
	value: unknown,
	descriptors: Map<string, CatalogResourceDescriptor>,
): VersionedCatalogVariant {
	const variant = exactObject(value, ["effect", "label", "variantId"]);
	const effect = exactObject(variant.effect, ["kind", "resource"]);
	if (effect.kind !== "model-resource") rejectEnvelope();
	return {
		label: exactLabel(variant.label),
		resource: exactResource(
			effect.resource,
			"model/gltf-binary",
			26_214_400,
			descriptors,
		),
		variantId: exactIdentifier(variant.variantId),
	};
}

function exactDimensions(value: unknown): {
	readonly depth: number;
	readonly height: number;
	readonly width: number;
} {
	const dimensions = exactObject(value, ["depth", "height", "width"]);
	return {
		depth: exactPositiveInteger(dimensions.depth, 100_000),
		height: exactPositiveInteger(dimensions.height, 100_000),
		width: exactPositiveInteger(dimensions.width, 100_000),
	};
}

function exactResource(
	value: unknown,
	mediaType: CatalogResourceMediaType,
	maximumBytes: number,
	descriptors: Map<string, CatalogResourceDescriptor>,
): CatalogResourceDescriptor {
	const resource = exactObject(value, ["byteLength", "mediaType", "sha256"]);
	const sha256 = exactString(resource.sha256);
	if (!hashPattern.test(sha256) || resource.mediaType !== mediaType)
		rejectEnvelope();
	const descriptor = {
		byteLength: exactPositiveInteger(resource.byteLength, maximumBytes),
		mediaType,
		sha256,
	};
	const previous = descriptors.get(sha256);
	if (
		previous &&
		(previous.byteLength !== descriptor.byteLength ||
			previous.mediaType !== descriptor.mediaType)
	) {
		rejectEnvelope();
	}
	descriptors.set(sha256, descriptor);
	return descriptor;
}

function exactObject(
	value: unknown,
	keys: readonly string[],
	optional: readonly string[] = [],
): JsonObject {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		rejectEnvelope();
	}
	const object = value as JsonObject;
	const actual = Object.keys(object).sort();
	const allowed = [...keys].sort();
	if (actual.some((key) => !allowed.includes(key))) rejectEnvelope();
	if (keys.some((key) => !optional.includes(key) && !actual.includes(key))) {
		rejectEnvelope();
	}
	return object;
}

function exactString(value: unknown): string {
	if (typeof value !== "string") rejectEnvelope();
	return value;
}

function exactIdentifier(value: unknown): string {
	const result = exactString(value);
	if (!identifierPattern.test(result)) rejectEnvelope();
	return result;
}

function exactLabel(value: unknown): string {
	const label = exactString(value);
	if (
		[...label].length < 1 ||
		[...label].length > 120 ||
		[...label].some((character) => {
			const codePoint = character.codePointAt(0);
			return (
				codePoint !== undefined && codePoint >= 0xd800 && codePoint <= 0xdfff
			);
		}) ||
		new TextEncoder().encode(label).byteLength > 240 ||
		label.normalize("NFC") !== label
	) {
		rejectEnvelope();
	}
	return label;
}

function exactPositiveInteger(value: unknown, maximum: number): number {
	if (
		!Number.isSafeInteger(value) ||
		(value as number) < 1 ||
		(value as number) > maximum
	) {
		rejectEnvelope();
	}
	return value as number;
}

function requireSortedUnique(values: readonly string[]): void {
	if (
		values.some(
			(value, index) => index > 0 && value <= (values[index - 1] ?? ""),
		)
	) {
		rejectEnvelope();
	}
}

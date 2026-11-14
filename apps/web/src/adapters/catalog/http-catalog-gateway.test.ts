import { describe, expect, it, rstest } from "@rstest/core";

import validEnvelope from "../../../../../contracts/catalog-control-plane/fixtures/catalog-envelope-v1.valid.json" with {
	type: "json",
};
import type { BinaryChecksumPort } from "../../application/ports";
import { HttpCatalogGateway } from "./http-catalog-gateway";

const modelHash = "a".repeat(64);
const thumbnailHash = "b".repeat(64);
const envelopeHash = "c".repeat(64);
const minimalGlb = Uint8Array.from(
	atob("Z2xURgIAAAAwAAAAHAAAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAifX0g"),
	(character) => character.charCodeAt(0),
);

function envelope(extra = ""): string {
	return `{"schemaVersion":1,"catalogVersion":"alpha-2026-08-26.1","publishedAt":"2026-08-26T20:00:00Z","assets":[{"assetId":"single-bed","label":"Кровать","section":"furniture","category":"sleep","anchorClass":"floor","frontDirection":"positive-z","dimensionsMm":{"width":1769,"depth":1075,"height":426},"footprintMm":{"kind":"rectangle","width":1769,"depth":1075},"resource":{"sha256":"${modelHash}","byteLength":${minimalGlb.byteLength},"mediaType":"model/gltf-binary"},"thumbnail":{"sha256":"${thumbnailHash}","byteLength":3,"mediaType":"image/png"},"variantSlots":[]}]${extra}}`;
}

const checksum: BinaryChecksumPort = {
	sha256Bytes: async (bytes) =>
		bytes.byteLength === minimalGlb.byteLength ? modelHash : envelopeHash,
};

function envelopeResponse(
	body = envelope(),
	etag = `"${envelopeHash}"`,
): Response {
	return new Response(body, {
		headers: {
			"content-length": String(new TextEncoder().encode(body).byteLength),
			"content-type": "application/json; charset=utf-8",
			etag,
		},
		status: 200,
	});
}

function resourceResponse(body = minimalGlb): Response {
	return new Response(body, {
		headers: {
			"accept-ranges": "bytes",
			"content-length": String(body.byteLength),
			"content-type": "model/gltf-binary",
			etag: `"${modelHash}"`,
		},
		status: 200,
	});
}

type MutableJson =
	| boolean
	| null
	| number
	| string
	| MutableJson[]
	| MutableObject;
type MutableObject = { [key: string]: MutableJson };

function validCandidate(): MutableObject {
	return JSON.parse(JSON.stringify(validEnvelope)) as MutableObject;
}

function objectAt(root: MutableObject, path: string): MutableObject {
	let value: MutableJson = root;
	for (const segment of path.split("/").filter(Boolean)) {
		if (Array.isArray(value)) value = value[Number(segment)] ?? null;
		else if (value !== null && typeof value === "object")
			value = value[segment] ?? null;
		else throw new Error(`Invalid fixture path: ${path}`);
	}
	if (value === null || Array.isArray(value) || typeof value !== "object") {
		throw new Error(`Fixture path is not an object: ${path}`);
	}
	return value;
}

function arrayAt(root: MutableObject, path: string): MutableJson[] {
	const segments = path.split("/").filter(Boolean);
	const key = segments.pop();
	if (!key) throw new Error(`Invalid fixture path: ${path}`);
	const parent = objectAt(root, `/${segments.join("/")}`);
	const value = parent[key];
	if (!Array.isArray(value))
		throw new Error(`Fixture path is not an array: ${path}`);
	return value;
}

function gatewayForJson(
	value: MutableObject,
	headers: HeadersInit = {},
): HttpCatalogGateway {
	const body = JSON.stringify(value);
	return new HttpCatalogGateway({
		checksum: { sha256Bytes: async () => envelopeHash },
		fetcher: async () =>
			new Response(body, {
				headers: {
					"content-length": String(new TextEncoder().encode(body).byteLength),
					"content-type": "application/json; charset=utf-8",
					etag: `"${envelopeHash}"`,
					...headers,
				},
				status: 200,
			}),
	});
}

function modelVariant(): MutableObject {
	return {
		kind: "model-resource",
		label: "Модель",
		slotId: "model",
		variants: [
			{
				effect: {
					kind: "model-resource",
					resource: {
						byteLength: 2_333_896,
						mediaType: "model/gltf-binary",
						sha256:
							"9dd295594623edf797cee3d4da1818802d723b404df51687d6ca1796f51b4608",
					},
				},
				label: "Шкаф",
				variantId: "cabinet-shape",
			},
		],
	};
}

describe("HTTP CatalogGatewayPort", () => {
	it("loads a strict versioned envelope without credentials or Project data", async () => {
		const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> =
			[];
		const fetcher: typeof fetch = async (input, init) => {
			requests.push({ input, init });
			return envelopeResponse();
		};
		const gateway = new HttpCatalogGateway({ checksum, fetcher });

		const result = await gateway.currentPublication();

		expect(result).toEqual({
			kind: "available",
			publication: {
				assets: [
					{
						anchorClass: "floor",
						assetId: "single-bed",
						category: "sleep",
						dimensionsMm: { depth: 1075, height: 426, width: 1769 },
						frontDirection: "positive-z",
						label: "Кровать",
						resource: {
							byteLength: minimalGlb.byteLength,
							mediaType: "model/gltf-binary",
							sha256: modelHash,
						},
						section: "furniture",
						thumbnail: {
							byteLength: 3,
							mediaType: "image/png",
							sha256: thumbnailHash,
						},
						variantSlots: [],
					},
				],
				catalogVersion: "alpha-2026-08-26.1",
				envelopeHash,
				publishedAt: "2026-08-26T20:00:00Z",
			},
		});
		const request = requests[0];
		if (!request) throw new Error("Expected a catalog request");
		const headers = new Headers(request.init?.headers);
		expect(String(request.input)).toBe("/catalog-api/v1/catalogs/current");
		expect(request.init?.credentials).toBe("omit");
		expect(request.init?.redirect).toBe("error");
		expect(request.init?.body).toBeUndefined();
		expect(headers.get("accept")).toBe("application/json");
		expect(headers.has("authorization")).toBe(false);
		expect(headers.has("cookie")).toBe(false);
	});

	it("rejects an envelope with an undeclared member", async () => {
		const gateway = new HttpCatalogGateway({
			checksum,
			fetcher: async () =>
				envelopeResponse(envelope(',"project":{"projectId":"must-not-cross"}')),
		});

		expect(await gateway.currentPublication()).toEqual({
			kind: "invalid-envelope",
			reasonCode: "CATALOG_ENVELOPE_SCHEMA_INVALID",
		});
	});

	it("enforces the complete closed envelope boundary", async () => {
		const invalidChanges: ReadonlyArray<
			readonly [string, (candidate: MutableObject) => void]
		> = [
			[
				"schema",
				(candidate) => {
					candidate.schemaVersion = 2;
				},
			],
			[
				"version-type",
				(candidate) => {
					candidate.catalogVersion = 1;
				},
			],
			[
				"version-grammar",
				(candidate) => {
					candidate.catalogVersion = "UPPERCASE";
				},
			],
			[
				"reserved-current-version",
				(candidate) => {
					candidate.catalogVersion = "current";
				},
			],
			[
				"timestamp",
				(candidate) => {
					candidate.publishedAt = "2026-02-30T00:00:00Z";
				},
			],
			[
				"root-extra",
				(candidate) => {
					candidate.project = "forbidden";
				},
			],
			[
				"empty-assets",
				(candidate) => {
					candidate.assets = [];
				},
			],
			[
				"asset-extra",
				(candidate) => {
					objectAt(candidate, "/assets/0").projectId = "forbidden";
				},
			],
			[
				"unpaired-label-surrogate",
				(candidate) => {
					objectAt(candidate, "/assets/0").label = "\uD800";
				},
			],
			[
				"asset-id",
				(candidate) => {
					objectAt(candidate, "/assets/0").assetId = "Bad";
				},
			],
			[
				"label-empty",
				(candidate) => {
					objectAt(candidate, "/assets/0").label = "";
				},
			],
			[
				"label-scalars",
				(candidate) => {
					objectAt(candidate, "/assets/0").label = "x".repeat(121);
				},
			],
			[
				"label-bytes",
				(candidate) => {
					objectAt(candidate, "/assets/0").label = "😀".repeat(61);
				},
			],
			[
				"label-nfc",
				(candidate) => {
					objectAt(candidate, "/assets/0").label = "е\u0308";
				},
			],
			[
				"section",
				(candidate) => {
					objectAt(candidate, "/assets/0").section = "marketplace";
				},
			],
			[
				"category",
				(candidate) => {
					objectAt(candidate, "/assets/0").category = "unknown";
				},
			],
			[
				"anchor",
				(candidate) => {
					objectAt(candidate, "/assets/0").anchorClass = "ceiling";
				},
			],
			[
				"front",
				(candidate) => {
					objectAt(candidate, "/assets/0").frontDirection = "negative-z";
				},
			],
			[
				"dimension-extra",
				(candidate) => {
					objectAt(candidate, "/assets/0/dimensionsMm").x = 1;
				},
			],
			[
				"dimension-zero",
				(candidate) => {
					objectAt(candidate, "/assets/0/dimensionsMm").width = 0;
				},
			],
			[
				"dimension-high",
				(candidate) => {
					objectAt(candidate, "/assets/0/dimensionsMm").height = 100_001;
				},
			],
			[
				"footprint-kind",
				(candidate) => {
					objectAt(candidate, "/assets/0/footprintMm").kind = "circle";
				},
			],
			[
				"footprint-mismatch",
				(candidate) => {
					objectAt(candidate, "/assets/0/footprintMm").width = 1;
				},
			],
			[
				"model-hash",
				(candidate) => {
					objectAt(candidate, "/assets/0/resource").sha256 = "a";
				},
			],
			[
				"model-length",
				(candidate) => {
					objectAt(candidate, "/assets/0/resource").byteLength = 26_214_401;
				},
			],
			[
				"model-media",
				(candidate) => {
					objectAt(candidate, "/assets/0/resource").mediaType = "image/png";
				},
			],
			[
				"model-extra",
				(candidate) => {
					objectAt(candidate, "/assets/0/resource").url = "forbidden";
				},
			],
			[
				"thumbnail-length",
				(candidate) => {
					objectAt(candidate, "/assets/0/thumbnail").byteLength = 262_145;
				},
			],
			[
				"thumbnail-media",
				(candidate) => {
					objectAt(candidate, "/assets/0/thumbnail").mediaType =
						"model/gltf-binary";
				},
			],
			[
				"two-slots",
				(candidate) => {
					const slots = arrayAt(candidate, "/assets/0/variantSlots");
					slots.push(modelVariant(), modelVariant());
				},
			],
		];

		for (const [id, change] of invalidChanges) {
			const candidate = validCandidate();
			change(candidate);
			expect(
				(await gatewayForJson(candidate).currentPublication()).kind,
				id,
			).toBe("invalid-envelope");
		}
	});

	it("accepts one complete model variant and rejects its closed nested boundary", async () => {
		const accepted = validCandidate();
		arrayAt(accepted, "/assets/0/variantSlots").push(modelVariant());
		expect(await gatewayForJson(accepted).currentPublication()).toMatchObject({
			kind: "available",
			publication: {
				assets: [
					{ variantSlots: [{ variants: [{ variantId: "cabinet-shape" }] }] },
				],
			},
		});

		const invalidChanges: ReadonlyArray<(candidate: MutableObject) => void> = [
			(candidate) => {
				objectAt(candidate, "/assets/0/variantSlots/0").extra = true;
			},
			(candidate) => {
				objectAt(candidate, "/assets/0/variantSlots/0").kind = "color";
			},
			(candidate) => {
				objectAt(candidate, "/assets/0/variantSlots/0").slotId = "Bad";
			},
			(candidate) => {
				arrayAt(candidate, "/assets/0/variantSlots/0/variants").splice(0);
			},
			(candidate) => {
				objectAt(candidate, "/assets/0/variantSlots/0/variants/0").extra = true;
			},
			(candidate) => {
				objectAt(candidate, "/assets/0/variantSlots/0/variants/0/effect").kind =
					"color";
			},
			(candidate) => {
				objectAt(
					candidate,
					"/assets/0/variantSlots/0/variants/0/effect/resource",
				).mediaType = "image/png";
			},
		];
		for (const change of invalidChanges) {
			const candidate = validCandidate();
			arrayAt(candidate, "/assets/0/variantSlots").push(modelVariant());
			change(candidate);
			expect((await gatewayForJson(candidate).currentPublication()).kind).toBe(
				"invalid-envelope",
			);
		}
	});

	it("enforces asset and variant ordering plus descriptor alias identity", async () => {
		const unsortedAssets = validCandidate();
		const assets = arrayAt(unsortedAssets, "/assets");
		const clone = structuredClone(assets[0]);
		if (clone === null || Array.isArray(clone) || typeof clone !== "object") {
			throw new Error("Expected asset object");
		}
		clone.assetId = "aaa";
		assets.push(clone);
		expect(
			(await gatewayForJson(unsortedAssets).currentPublication()).kind,
		).toBe("invalid-envelope");

		const duplicateVariants = validCandidate();
		const slot = modelVariant();
		const variants = arrayAt(slot, "/variants");
		variants.push(structuredClone(variants[0]));
		arrayAt(duplicateVariants, "/assets/0/variantSlots").push(slot);
		expect(
			(await gatewayForJson(duplicateVariants).currentPublication()).kind,
		).toBe("invalid-envelope");

		const conflictingDescriptor = validCandidate();
		const asset = objectAt(conflictingDescriptor, "/assets/0");
		const thumbnail = objectAt(conflictingDescriptor, "/assets/0/thumbnail");
		thumbnail.sha256 =
			objectAt(conflictingDescriptor, "/assets/0/resource").sha256 ?? "";
		asset.thumbnail = thumbnail;
		expect(
			(await gatewayForJson(conflictingDescriptor).currentPublication()).kind,
		).toBe("invalid-envelope");
	});

	it("rejects envelope bytes that do not reproduce the response ETag", async () => {
		const gateway = new HttpCatalogGateway({
			checksum: { sha256Bytes: async () => "d".repeat(64) },
			fetcher: async () => envelopeResponse(),
		});

		expect(await gateway.currentPublication()).toEqual({
			kind: "invalid-envelope",
			reasonCode: "CATALOG_ENVELOPE_SCHEMA_INVALID",
		});
	});

	it("accepts a checksum-verifiable envelope when a tunnel downgrades its ETag to weak", async () => {
		const gateway = new HttpCatalogGateway({
			checksum,
			fetcher: async () => envelopeResponse(undefined, `W/"${envelopeHash}"`),
		});

		expect((await gateway.currentPublication()).kind).toBe("available");
	});

	it("keeps a network outage and cancellation distinct", async () => {
		const outage = new HttpCatalogGateway({
			checksum,
			fetcher: async () => {
				throw new TypeError("offline");
			},
		});
		const cancelled = new AbortController();
		cancelled.abort();

		expect(await outage.currentPublication()).toEqual({ kind: "unavailable" });
		expect(await outage.currentPublication(cancelled.signal)).toEqual({
			kind: "cancelled",
		});
	});

	it("ends a stalled catalog publication after its default 15-second deadline", async () => {
		rstest.useFakeTimers();
		try {
			const outcomes: unknown[] = [];
			const gateway = new HttpCatalogGateway({
				checksum,
				fetcher: async (_input, init) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () =>
							reject(new DOMException("Aborted", "AbortError")),
						);
					}),
			});
			void gateway.currentPublication().then((result) => outcomes.push(result));

			await rstest.advanceTimersByTimeAsync(14_999);
			expect(outcomes).toEqual([]);
			await rstest.advanceTimersByTimeAsync(1);
			expect(outcomes).toEqual([{ kind: "unavailable" }]);
			expect(rstest.getTimerCount()).toBe(0);
		} finally {
			rstest.useRealTimers();
		}
	});

	it("applies the configured publication deadline while the response body is stalled", async () => {
		rstest.useFakeTimers();
		try {
			const outcomes: unknown[] = [];
			const caller = new AbortController();
			const gateway = new HttpCatalogGateway({
				checksum,
				publicationRequestTimeoutMilliseconds: 250,
				fetcher: async (_input, init) =>
					new Response(
						new ReadableStream<Uint8Array>({
							start(controller) {
								init?.signal?.addEventListener("abort", () =>
									controller.error(new DOMException("Aborted", "AbortError")),
								);
							},
						}),
						{
							headers: {
								"content-type": "application/json",
								etag: `"${envelopeHash}"`,
							},
						},
					),
			});
			void gateway
				.currentPublication(caller.signal)
				.then((result) => outcomes.push(result));

			await rstest.advanceTimersByTimeAsync(249);
			expect(outcomes).toEqual([]);
			await rstest.advanceTimersByTimeAsync(1);
			expect(outcomes).toEqual([{ kind: "unavailable" }]);
			expect(caller.signal.aborted).toBe(false);
			expect(rstest.getTimerCount()).toBe(0);
		} finally {
			rstest.useRealTimers();
		}
	});

	it("cancels an in-flight publication on caller abort and clears its deadline", async () => {
		rstest.useFakeTimers();
		try {
			const caller = new AbortController();
			const gateway = new HttpCatalogGateway({
				checksum,
				fetcher: async (_input, init) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () =>
							reject(new DOMException("Aborted", "AbortError")),
						);
					}),
			});
			const result = gateway.currentPublication(caller.signal);
			caller.abort();

			await expect(result).resolves.toEqual({ kind: "cancelled" });
			expect(rstest.getTimerCount()).toBe(0);
		} finally {
			rstest.useRealTimers();
		}
	});

	it("never requests a publication already cancelled by its caller", async () => {
		const requests: unknown[] = [];
		const caller = new AbortController();
		caller.abort();
		const gateway = new HttpCatalogGateway({
			checksum,
			fetcher: async (input) => {
				requests.push(input);
				return envelopeResponse();
			},
		});

		await expect(gateway.currentPublication(caller.signal)).resolves.toEqual({
			kind: "cancelled",
		});
		expect(requests).toEqual([]);
	});

	it("releases the publication deadline and caller subscription after every completed response", async () => {
		rstest.useFakeTimers();
		try {
			for (const response of [
				envelopeResponse(),
				new Response(null, { status: 503 }),
				envelopeResponse("{}"),
			]) {
				const requests: RequestInit[] = [];
				const caller = new AbortController();
				const gateway = new HttpCatalogGateway({
					checksum,
					fetcher: async (_input, init) => {
						requests.push(init ?? {});
						return response;
					},
				});
				await gateway.currentPublication(caller.signal);
				caller.abort();
				await rstest.advanceTimersByTimeAsync(15_000);

				expect(requests[0]?.signal?.aborted).toBe(false);
				expect(rstest.getTimerCount()).toBe(0);
			}
		} finally {
			rstest.useRealTimers();
		}
	});

	it("accepts only bytes matching the declared media type, length and digest", async () => {
		const requests: RequestInit[] = [];
		const gateway = new HttpCatalogGateway({
			checksum,
			fetcher: async (_input, init) => {
				requests.push(init ?? {});
				return resourceResponse();
			},
		});
		const descriptor = {
			byteLength: minimalGlb.byteLength,
			mediaType: "model/gltf-binary" as const,
			sha256: modelHash,
		};

		expect(await gateway.resource(descriptor)).toEqual({
			bytes: minimalGlb,
			kind: "available",
			resourceHash: modelHash,
		});
		expect(new Headers(requests[0]?.headers).get("accept")).toBe(
			"model/gltf-binary",
		);
		expect(requests[0]?.redirect).toBe("error");
	});

	it("turns a stalled resource request into retryable unavailability", async () => {
		const gateway = new HttpCatalogGateway({
			checksum,
			fetcher: async (_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener(
						"abort",
						() => reject(new DOMException("Aborted", "AbortError")),
						{ once: true },
					);
				}),
			resourceRequestTimeoutMilliseconds: 1,
		});

		await expect(
			gateway.resource({
				byteLength: minimalGlb.byteLength,
				mediaType: "model/gltf-binary",
				sha256: modelHash,
			}),
		).resolves.toEqual({ kind: "unavailable" });
	});

	it("keeps an explicit caller cancellation distinct from its resource deadline", async () => {
		let resolveRequestStarted: (() => void) | undefined;
		const requestStarted = new Promise<void>((resolve) => {
			resolveRequestStarted = resolve;
		});
		const gateway = new HttpCatalogGateway({
			checksum,
			fetcher: async (_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					resolveRequestStarted?.();
					init?.signal?.addEventListener(
						"abort",
						() => reject(new DOMException("Aborted", "AbortError")),
						{ once: true },
					);
				}),
			resourceRequestTimeoutMilliseconds: 60_000,
		});
		const cancelled = new AbortController();
		const result = gateway.resource(
			{
				byteLength: minimalGlb.byteLength,
				mediaType: "model/gltf-binary",
				sha256: modelHash,
			},
			cancelled.signal,
		);
		await requestStarted;
		cancelled.abort();

		await expect(result).resolves.toEqual({ kind: "cancelled" });
	});

	it("reports integrity failure without exposing corrupt bytes", async () => {
		const gateway = new HttpCatalogGateway({
			checksum: { sha256Bytes: async () => "d".repeat(64) },
			fetcher: async () => resourceResponse(),
		});

		expect(
			await gateway.resource({
				byteLength: minimalGlb.byteLength,
				mediaType: "model/gltf-binary",
				sha256: modelHash,
			}),
		).toEqual({ kind: "integrity-failed" });
	});

	it("rejects digest-correct bytes outside the declared media profile", async () => {
		const malformed = Uint8Array.of(...minimalGlb);
		malformed[4] = 1;
		const gateway = new HttpCatalogGateway({
			checksum,
			fetcher: async () => resourceResponse(malformed),
		});

		expect(
			await gateway.resource({
				byteLength: malformed.byteLength,
				mediaType: "model/gltf-binary",
				sha256: modelHash,
			}),
		).toEqual({ kind: "integrity-failed" });
	});
});

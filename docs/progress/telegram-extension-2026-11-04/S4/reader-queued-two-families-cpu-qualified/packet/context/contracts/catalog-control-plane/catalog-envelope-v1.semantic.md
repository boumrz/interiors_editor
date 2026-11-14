# Catalog Envelope V1 — mandatory semantic profile

This profile and `catalog-envelope-v1.schema.json` together are the normative
cross-language contract. A validator that checks only JSON Schema is not
conformant. Kotlin, the TypeScript HTTP adapter, the fake gateway and the real
proxy smoke use the same fixtures listed by `fixtures/manifest.json`.

## Raw envelope validation order

1. Read at most 262,144 bytes and require well-formed UTF-8 without BOM.
2. Require exactly one complete JSON value with no trailing second document,
   then reject duplicate JSON object members before ordinary materialization.
3. Validate the JSON Schema with unknown members rejected.
4. Require every label to contain only well-formed Unicode scalar values, be
   Unicode NFC, contain at most 120 Unicode scalars and occupy at most 240
   UTF-8 bytes. Lone UTF-16 surrogates are rejected rather than replaced.
5. Require `publishedAt` to match the schema's UTC `Z` grammar, use a year from
   2000 through 9999, a Gregorian-calendar-valid month/day, hour 00–23, minute
   00–59, second 00–59 (leap seconds are rejected), and one through six
   fractional digits when a fraction exists. Different catalog versions cannot
   share the same instant. Host-language permissive date parsing is forbidden.
6. Reserve the literal content version `current` for the mutable current route;
   it is not an accepted immutable catalog version.
7. Require assets, the optional single slot and its variants to be sorted by
   their ids and unique within their parent.
8. Require `footprintMm.width/depth` to equal the asset dimensions.
9. For every repeated SHA-256, require identical byte length and media type.
10. Require each model descriptor to be `model/gltf-binary`; each thumbnail to
   be `image/png`; each model effect to contain exactly one complete
   replacement GLB.
11. Serialize the accepted value with RFC 8785 JSON Canonicalization Scheme,
    store those exact bytes, and use their lowercase SHA-256 as the quoted
    strong ETag. The service returns stored bytes and never reconstructs them
    with a runtime serializer.

An asset has zero or one independently selectable `model-resource` variant
slot. It selects one complete replacement model for the same asset definition.
Catalog-provided color/material effects are outside this control-plane slice;
the existing local parametric color command remains independent. There is no
multi-slot composition in Alpha.

Resource admission is media-specific. A GLB success requires descriptor
limits, response length/ranges, assembled length, SHA-256, then
`StaticCatalogGlbProfile-1` from the section below. A PNG success requires the
same bounded transport/hash checks, then `CatalogThumbnailPngProfile-1`; it
never runs GLB preflight. The byte cases in `fixtures/media-cases.json` are
mandatory for both Kotlin and TypeScript.

### CatalogThumbnailPngProfile-1

- exact eight-byte PNG signature; first chunk is `IHDR` with length 13;
- width 1–512, height 1–512 and `width * height * 4 <= 1,048,576`;
- bit depth 8; color type 2 (RGB) or 6 (RGBA); compression and filter method 0;
- interlace method 0; CRCs of every chunk must verify; exactly one `IHDR`, one
  or more `IDAT`, and a terminal `IEND` with no trailing bytes;
- inflate uses zlib with an output ceiling of
  `height * (1 + width * channels)` bytes and must end at exactly that length;
  every scanline filter byte is 0–4. No ancillary chunk changes acceptance.

### StaticCatalogGlbProfile-1

- byte length 20–26,214,400; little-endian GLB magic `0x46546c67`, version 2,
  declared length equal to the exact byte length;
- exactly one first JSON chunk (type `JSON`, positive 4-byte-aligned length)
  followed by zero or one BIN chunk (type `BIN`, 4-byte-aligned); no trailing
  bytes or other chunks; JSON is fatal UTF-8 and an object with
  `asset.version == "2.0"`;
- every `buffers[*].uri` and `images[*].uri` is forbidden; animations, skins,
  cameras and node `camera`/`skin` are forbidden;
- `extensionsUsed` and `extensionsRequired` may contain only
  `KHR_materials_unlit` and `KHR_texture_transform`;
- maxima: 256 nodes, 128 mesh primitives, 32 materials, 16 textures, 300,000
  distinct referenced POSITION vertices and 250,000 declared triangles;
- every embedded image is fully inside the BIN bufferView and has a PNG, JPEG
  or WebP header with positive dimensions; each dimension is at most 4096 and
  the sum of image pixels is at most 48,000,000.

Both profiles are bounded structural preflights, not claims that a decoder is
memory-safe. A later browser decoder remains no-network and disposable.

## Metadata response matrix

| Request | Result |
| --- | --- |
| `GET /catalog-api/v1/catalogs/current` | `200 application/json; charset=utf-8`, exact `Content-Length`, quoted body SHA-256 ETag, `no-cache, max-age=0, must-revalidate`; body is the selected current envelope |
| `GET /catalog-api/v1/catalogs/{version}` | same headers, but `public, max-age=31536000, immutable`; body `catalogVersion` must equal the decoded path version |
| Exact `If-None-Match` on either GET | `304`, ETag/cache headers, zero body |
| Valid absent version/current | `404`, `Cache-Control: no-store`, `Content-Length: 0` |
| Invalid encoded/path grammar | `400`, `no-store`, zero body |
| `Accept` absent, wildcard, multi-value or not exactly `application/json` | `406`, `no-store`, zero body |
| Any query, body, `Cookie` or `Authorization` | `400`, `no-store`, zero body, no reflection |
| Any non-GET method, including `OPTIONS` | `405`, exact `Allow: GET`, `no-store`, zero body |

The web maps timeout/network/429/5xx/current-404 to
`control-plane-unavailable`. A `200` with wrong content type/length/ETag,
malformed/oversized UTF-8 or failed schema/semantic validation maps to
`invalid-envelope`. Redirects are errors because fetch uses
`redirect: "error"`; credentials are always omitted.

## Resource response matrix

Only `GET` and bodyless/range-less `HEAD` are allowed. `Accept` must be exactly
the stored media type (`model/gltf-binary` or `image/png`); absent, wildcard,
multi-value or mismatch is bodyless `406`/`no-store`. Full/range successes
carry exact `Content-Type`, `Content-Length`, `Accept-Ranges: bytes`, quoted
resource-hash ETag, immutable cache header and no `Content-Encoding`.

Only `Range: bytes=<start>-<end>` with canonical decimals and an in-bounds
closed interval is accepted. It returns `206` and exact `Content-Range`.
Every other Range (open/suffix/multi/whitespace/overflow/out-of-bounds) returns
`416` with `Content-Range: bytes */<length>`, `no-store` and zero body.
`If-Range` is `400`. Exact non-range `If-None-Match` is `304` for both GET and
HEAD; a nonmatching quoted 64-hex ETag performs the ordinary full response,
while weak, wildcard, multi-value or malformed values are `400`. Resource errors
are otherwise bodyless/no-store and follow the metadata rejection rules; a
resource route advertises `Allow: GET, HEAD` on `405`.

## Same-origin and cache ownership

The service worker always passes `/catalog-api/**` to the network and never
puts those responses in Cache Storage. HTTP/browser caching may use the server
headers; no application-owned browse cache becomes a pinned Project resource.
The actual Rspack proxy contract is part of the real smoke.

## Exact PostgreSQL data schema

`catalog-operator-bootstrap-v1.sql` is the one-time operator-owned role/schema
bootstrap. `catalog-schema-v1.sql` is the Flyway migration run only as
`catalog_migrate`; it never creates/alters roles or schemas. Together they are
the normative DDL, including every SQL type, nullability rule,
primary/unique/foreign/check constraint, FK action and privilege. Prose in this
profile cannot relax or add a database object.

Only schemas `catalog_data` and `catalog_migration` are application-owned.
`catalog_migration` contains Flyway's `flyway_schema_history` only.
`catalog_data` contains exactly these tables and columns:

- `catalog_resource(resource_hash char(64) primary key, byte_length integer,
  media_type varchar(32), resource_bytes bytea)` with hash grammar, positive
  media-specific length and `octet_length` checks;
- `catalog_publication(catalog_version varchar(64) primary key,
  published_at timestamptz unique, envelope_hash char(64) unique,
  envelope_bytes bytea, asset_count smallint)` with grammar/body/count checks;
- `catalog_current(singleton boolean primary key check(singleton),
  catalog_version varchar(64) unique references catalog_publication)`;
- `catalog_asset(catalog_version, asset_id, label, section, category,
  anchor_class, front_direction, width_mm, depth_mm, height_mm,
  footprint_width_mm, footprint_depth_mm, model_hash, thumbnail_hash)` with
  composite primary key, publication/resource foreign keys, enum/limit checks;
- `catalog_variant_slot(catalog_version, asset_id, slot_id, label, slot_kind)`
  with composite asset foreign key, composite primary key and unique
  `(catalog_version, asset_id)` enforcing at most one slot; and
- `catalog_variant_option(catalog_version, asset_id, slot_id, variant_id,
  label, model_hash)` with composite slot/resource foreign keys.

Only primary/unique/foreign/check constraints and their indexes are permitted;
there are no application sequences, views, materialized views, functions,
triggers, large objects or additional columns. The normalized rows must round
trip losslessly to the stored canonical envelope and every descriptor alias
must match its single resource row.

## Commands and credentials

The Gradle commands are separate and run in this order:

1. `catalogMigrate` uses only `CATALOG_MIGRATION_DATABASE_*` and exits;
2. `catalogValidate` uses the same migration credential, runs Flyway validate
   only, and exits before the runtime process starts;
3. `catalogPublish` uses only `CATALOG_PUBLISH_DATABASE_*` and exits;
4. `run` uses only SELECT-scoped `CATALOG_DATABASE_*` and has no privilege on
   `catalog_migration`.

The running service fails startup when elevated credentials are present or a
single complete current publication is absent. The launcher must require a
successful `catalogValidate` result for the same build before invoking `run`.
None of the three credential sets is sent to browser code or logs.

The publisher process plus its private process-scoped credential is the
publication trust boundary. PostgreSQL enforces the normative structural DDL,
referential integrity, byte-length/hash grammar and immutability grants; the
database alone does not claim to parse PNG/GLB, recompute SHA-256, NFC-normalize
labels or reproduce RFC 8785 bytes. Executable evidence proves invalid input is
rejected by `catalogPublish` before its transaction. Direct use of the private
publisher credential outside that command is an operator-boundary violation,
not an accepted application path.

The no-Project assertion is structural and decidable: the HTTP request shape,
application DTOs, exact column allowlist and database object allowlist contain
no Project/Revision/History/Backup/account/user-pinned field or generic upload
body. Arbitrary free labels and opaque identifiers are never classified by
matching their text against Project names or ids.

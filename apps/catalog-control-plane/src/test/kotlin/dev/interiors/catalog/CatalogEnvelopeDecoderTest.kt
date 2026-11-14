package dev.interiors.catalog

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import java.nio.file.Files
import java.nio.file.Path
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class CatalogEnvelopeDecoderTest {
    private val fixtures = Path.of("../../contracts/catalog-control-plane/fixtures")
    private val mapper = ObjectMapper()

    @Test
    fun `decodes the shared valid envelope without Project-shaped data`() {
        val envelope = CatalogEnvelopeDecoder.decode(fixture("catalog-envelope-v1.valid.json"))

        assertEquals("alpha-2026-08-26.1", envelope.catalogVersion)
        assertEquals("single-bed", envelope.assets.single().assetId)
        assertEquals("Кровать", envelope.assets.single().label)
        assertEquals("positive-z", envelope.assets.single().frontDirection)
        assertEquals(3_157_360, envelope.assets.single().resource.byteLength)
        assertEquals("model/gltf-binary", envelope.assets.single().resource.mediaType)
        assertNotNull(envelope.assets.single().thumbnail)
    }

    @Test
    fun `rejects duplicate members before materializing JSON`() {
        val failure = assertFailsWith<CatalogContractViolation> {
            CatalogEnvelopeDecoder.decode(fixture("catalog-envelope-v1.duplicate-member.json"))
        }

        assertEquals("CATALOG_ENVELOPE_DUPLICATE_MEMBER", failure.reasonCode)
    }

    @Test
    fun `rejects an empty publication`() {
        val failure = assertFailsWith<CatalogContractViolation> {
            CatalogEnvelopeDecoder.decode(fixture("catalog-envelope-v1.empty-assets.json"))
        }

        assertEquals("CATALOG_ENVELOPE_SCHEMA_INVALID", failure.reasonCode)
    }

    @Test
    fun `matches every shared negative envelope reason code`() {
        val cases = mapper.readTree(fixture("manifest.json")).required("negative")

        for (case in cases) {
            val failure = assertFailsWith<CatalogContractViolation>(case.required("file").textValue()) {
                CatalogEnvelopeDecoder.decode(fixture(case.required("file").textValue()))
            }
            assertEquals(case.required("reasonCode").textValue(), failure.reasonCode, case.required("file").textValue())
        }
    }

    @Test
    fun `executes the shared semantic case matrix`() {
        val semantic = mapper.readTree(fixture("semantic-cases.json"))
        val modelVariant = semantic.required("cases").single { it.required("id").textValue() == "valid-model-resource-variant" }

        for (case in semantic.required("cases")) {
            val candidate = validNode()
            applySemanticCase(candidate, case, modelVariant)
            if (case.required("outcome").textValue() == "accepted") {
                val decoded = CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate))
                val slot = decoded.assets.single().variantSlots.single()
                assertEquals("model-resource", slot.kind)
                assertEquals("cabinet-shape", slot.variants.single().variantId)
                assertEquals(2_333_896, slot.variants.single().resource.byteLength)
            } else {
                val failure = assertFailsWith<CatalogContractViolation>(case.required("id").textValue()) {
                    CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate))
                }
                assertEquals(case.required("reasonCode").textValue(), failure.reasonCode, case.required("id").textValue())
            }
        }
    }

    @Test
    fun `rejects envelope and descriptor boundary violations`() {
        val cases = listOf<Pair<String, (ObjectNode) -> Unit>>(
            "root-unknown" to { it.put("projectId", "forbidden") },
            "bad-version" to { it.put("catalogVersion", "UPPERCASE") },
            "bad-schema" to { it.put("schemaVersion", 2) },
            "bad-dimension" to { it.withObject("/assets/0/dimensionsMm").put("width", 0) },
            "bad-model-size" to { it.withObject("/assets/0/resource").put("byteLength", 26_214_401) },
            "bad-thumbnail-size" to { it.withObject("/assets/0/thumbnail").put("byteLength", 262_145) },
            "bad-hash" to { it.withObject("/assets/0/resource").put("sha256", "a") },
            "bad-front" to { it.withObject("/assets/0").put("frontDirection", "negative-z") },
            "bad-anchor" to { it.withObject("/assets/0").put("anchorClass", "ceiling") },
        )
        for ((id, mutate) in cases) {
            val candidate = validNode().also(mutate)
            val failure = assertFailsWith<CatalogContractViolation>(id) {
                CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate))
            }
            assertEquals("CATALOG_ENVELOPE_SCHEMA_INVALID", failure.reasonCode, id)
        }
    }

    @Test
    fun `rejects malformed utf8 bom and oversized raw bytes`() {
        val malformed = byteArrayOf('{'.code.toByte(), '"'.code.toByte(), 0xc3.toByte(), '"'.code.toByte(), '}'.code.toByte())
        val bom = byteArrayOf(0xef.toByte(), 0xbb.toByte(), 0xbf.toByte()) + fixture("catalog-envelope-v1.valid.json")
        val oversized = ByteArray(262_145) { ' '.code.toByte() }

        for (bytes in listOf(malformed, bom, oversized, byteArrayOf())) {
            assertEquals(
                "CATALOG_ENVELOPE_SCHEMA_INVALID",
                assertFailsWith<CatalogContractViolation> { CatalogEnvelopeDecoder.decode(bytes) }.reasonCode,
            )
        }
    }

    @Test
    fun `rejects trailing JSON documents instead of discarding prohibited data`() {
        val candidate = fixture("catalog-envelope-v1.valid.json") +
            "{\"projectId\":\"forbidden\"}".toByteArray(Charsets.UTF_8)

        assertEquals(
            "CATALOG_ENVELOPE_SCHEMA_INVALID",
            assertFailsWith<CatalogContractViolation> { CatalogEnvelopeDecoder.decode(candidate) }.reasonCode,
        )
    }

    @Test
    fun `rejects labels containing an unpaired UTF-16 surrogate`() {
        val candidate = fixture("catalog-envelope-v1.valid.json")
            .toString(Charsets.UTF_8)
            .replace("\"label\":\"Кровать\"", "\"label\":\"\\uD800\"")
            .toByteArray(Charsets.UTF_8)

        assertEquals(
            "CATALOG_ENVELOPE_SCHEMA_INVALID",
            assertFailsWith<CatalogContractViolation> { CatalogEnvelopeDecoder.decode(candidate) }.reasonCode,
        )
    }

    @Test
    fun `reserves current from immutable catalog version identifiers`() {
        val candidate = validNode().put("catalogVersion", "current")

        assertEquals(
            "CATALOG_ENVELOPE_SCHEMA_INVALID",
            assertFailsWith<CatalogContractViolation> {
                CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate))
            }.reasonCode,
        )
    }

    @Test
    fun `accepts exact contract maxima and rejects one item over collection maxima`() {
        val candidate = validNode()
        val asset = candidate.at("/assets/0") as ObjectNode
        asset.put("label", "😀".repeat(60))
        asset.withObject("/dimensionsMm").put("width", 100_000)
        asset.withObject("/footprintMm").put("width", 100_000)
        asset.withObject("/resource").put("byteLength", 26_214_400)
        asset.withObject("/thumbnail").put("byteLength", 262_144)
        val atDescriptorMaxima = CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate)).assets.single()
        assertEquals(26_214_400, atDescriptorMaxima.resource.byteLength)
        assertEquals(262_144, atDescriptorMaxima.thumbnail?.byteLength)

        asset.put("label", "x")
        asset.withObject("/resource").put("byteLength", 1)
        asset.remove("thumbnail")
        val assets = candidate.required("assets") as ArrayNode
        assets.removeAll()
        repeat(256) { index -> assets.add(asset.deepCopy().put("assetId", "a%03d".format(index))) }

        assertEquals(256, CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate)).assets.size)

        assets.add(asset.deepCopy().put("assetId", "a256"))
        assertEquals(
            "CATALOG_ENVELOPE_SCHEMA_INVALID",
            assertFailsWith<CatalogContractViolation> {
                CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate))
            }.reasonCode,
        )
    }

    @Test
    fun `accepts an envelope at the raw byte ceiling`() {
        val original = fixture("catalog-envelope-v1.valid.json")
        val exactMaximum = original + ByteArray(262_144 - original.size) { ' '.code.toByte() }

        assertEquals("alpha-2026-08-26.1", CatalogEnvelopeDecoder.decode(exactMaximum).catalogVersion)
    }

    @Test
    fun `enforces nested object allowlists and optional thumbnail semantics`() {
        val paths = listOf(
            "/assets/0" to "projectId",
            "/assets/0/dimensionsMm" to "x",
            "/assets/0/footprintMm" to "x",
            "/assets/0/resource" to "url",
            "/assets/0/thumbnail" to "url",
        )
        for ((path, field) in paths) {
            val candidate = validNode()
            (candidate.at(path) as ObjectNode).put(field, "forbidden")
            assertFailsWith<CatalogContractViolation>(path) {
                CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate))
            }
        }

        val withoutThumbnail = validNode()
        (withoutThumbnail.at("/assets/0") as ObjectNode).remove("thumbnail")
        assertEquals(null, CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(withoutThumbnail)).assets.single().thumbnail)
    }

    @Test
    fun `accepts 120 label scalars and rejects zero or 121`() {
        val exact = validNode()
        (exact.at("/assets/0") as ObjectNode).put("label", "x".repeat(120))
        assertEquals(120, CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(exact)).assets.single().label.length)

        for (label in listOf("", "x".repeat(121))) {
            val invalid = validNode()
            (invalid.at("/assets/0") as ObjectNode).put("label", label)
            assertFailsWith<CatalogContractViolation> {
                CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(invalid))
            }
        }
    }

    @Test
    fun `enforces variant object allowlists ordering and maximum count`() {
        val semantic = mapper.readTree(fixture("semantic-cases.json"))
        val modelVariant = semantic.required("cases").single { it.required("id").textValue() == "valid-model-resource-variant" }
        val candidate = validNode()
        applySemanticCase(candidate, modelVariant, modelVariant)
        val slot = candidate.at("/assets/0/variantSlots/0") as ObjectNode
        val baseVariant = slot.at("/variants/0") as ObjectNode

        for (path in listOf("/assets/0/variantSlots/0", "/assets/0/variantSlots/0/variants/0", "/assets/0/variantSlots/0/variants/0/effect")) {
            val invalid = candidate.deepCopy()
            (invalid.at(path) as ObjectNode).put("projectId", "forbidden")
            assertFailsWith<CatalogContractViolation>(path) {
                CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(invalid))
            }
        }

        val variants = slot.required("variants") as ArrayNode
        variants.removeAll()
        repeat(32) { index -> variants.add(baseVariant.deepCopy().put("variantId", "v%02d".format(index))) }
        assertEquals(32, CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate)).assets.single().variantSlots.single().variants.size)

        variants.add(baseVariant.deepCopy().put("variantId", "v32"))
        assertFailsWith<CatalogContractViolation> { CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(candidate)) }

        val unsorted = validNode()
        applySemanticCase(unsorted, modelVariant, modelVariant)
        val unsortedVariants = unsorted.at("/assets/0/variantSlots/0/variants") as ArrayNode
        unsortedVariants.add((unsortedVariants[0] as ObjectNode).deepCopy().put("variantId", "aaa"))
        assertEquals(
            "CATALOG_VARIANTS_NOT_SORTED",
            assertFailsWith<CatalogContractViolation> {
                CatalogEnvelopeDecoder.decode(mapper.writeValueAsBytes(unsorted))
            }.reasonCode,
        )
    }

    private fun fixture(name: String): ByteArray = Files.readAllBytes(fixtures.resolve(name))

    private fun validNode(): ObjectNode = mapper.readTree(fixture("catalog-envelope-v1.valid.json")) as ObjectNode

    private fun applySemanticCase(candidate: ObjectNode, case: com.fasterxml.jackson.databind.JsonNode, modelVariant: com.fasterxml.jackson.databind.JsonNode) {
        val assets = candidate.required("assets") as ArrayNode
        val asset = assets[0] as ObjectNode
        val variantValue = modelVariant.required("value").deepCopy<ArrayNode>()
        when (case.required("id").textValue()) {
            "valid-model-resource-variant" -> asset.set<ArrayNode>("variantSlots", case.required("value").deepCopy())
            "two-variant-slots" -> {
                asset.set<ArrayNode>("variantSlots", variantValue)
                (asset.required("variantSlots") as ArrayNode).add(variantValue[0].deepCopy<com.fasterxml.jackson.databind.JsonNode>())
            }
            "variant-discriminant-mismatch" -> {
                asset.set<ArrayNode>("variantSlots", variantValue)
                (asset.at("/variantSlots/0/variants/0/effect") as ObjectNode).put("kind", "color")
            }
            "unsorted-assets" -> assets.add(asset.deepCopy().put("assetId", case.required("assetId").textValue()))
            "footprint-mismatch" -> (asset.required("footprintMm") as ObjectNode).put("width", case.required("value").intValue())
            "invalid-real-date" -> candidate.put("publishedAt", case.required("value").textValue())
            "label-over-240-utf8-bytes" -> asset.put("label", case.required("value").textValue().repeat(case.required("count").intValue()))
            else -> assertNotNull(null, "Unhandled semantic case ${case.required("id").textValue()}")
        }
    }

    private fun com.fasterxml.jackson.databind.JsonNode.required(field: String) =
        get(field) ?: error("Missing fixture field: $field")
}

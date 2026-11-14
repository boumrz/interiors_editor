package dev.interiors.catalog

import com.fasterxml.jackson.core.JsonFactory
import com.fasterxml.jackson.core.JsonParseException
import com.fasterxml.jackson.core.JsonProcessingException
import com.fasterxml.jackson.core.StreamReadFeature
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.nio.ByteBuffer
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.text.Normalizer
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException

data class CatalogEnvelope(
    val schemaVersion: Int,
    val catalogVersion: String,
    val publishedAt: String,
    val assets: List<CatalogAsset>,
)

data class CatalogAsset(
    val assetId: String,
    val label: String,
    val section: String,
    val category: String,
    val anchorClass: String,
    val frontDirection: String,
    val dimensionsMm: CatalogDimensions,
    val footprintMm: CatalogFootprint,
    val resource: CatalogResourceDescriptor,
    val thumbnail: CatalogResourceDescriptor?,
    val variantSlots: List<CatalogVariantSlot>,
)

data class CatalogDimensions(val width: Int, val depth: Int, val height: Int)
data class CatalogFootprint(val kind: String, val width: Int, val depth: Int)
data class CatalogResourceDescriptor(val sha256: String, val byteLength: Int, val mediaType: String)
data class CatalogVariantSlot(
    val slotId: String,
    val label: String,
    val kind: String,
    val variants: List<CatalogVariant>,
)
data class CatalogVariant(
    val variantId: String,
    val label: String,
    val resource: CatalogResourceDescriptor,
)

class CatalogContractViolation(val reasonCode: String) : IllegalArgumentException(reasonCode)

object CatalogEnvelopeDecoder {
    private const val maximumEnvelopeBytes = 262_144
    private val identifier = Regex("^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")
    private val version = Regex("^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$")
    private val sha256 = Regex("^[0-9a-f]{64}$")
    private val timestamp = Regex(
        "^[2-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9](?:\\.[0-9]{1,6})?Z$",
    )
    private val sections = setOf(
        "furniture", "plumbing", "appliances-electronics", "lighting", "accessories",
    )
    private val categories = setOf(
        "seating", "tables", "storage", "sleep", "plumbing", "appliance",
        "electronics", "lighting", "accessory",
    )
    private val mapper = ObjectMapper(
        JsonFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build(),
    ).enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)

    fun decode(bytes: ByteArray): CatalogEnvelope {
        if (bytes.isEmpty() || bytes.size > maximumEnvelopeBytes || hasUtf8Bom(bytes)) invalid()
        val text = decodeUtf8(bytes)
        val root = try {
            mapper.readTree(text)
        } catch (failure: JsonParseException) {
            if (failure.message.orEmpty().contains("Duplicate field")) {
                throw CatalogContractViolation("CATALOG_ENVELOPE_DUPLICATE_MEMBER")
            }
            invalid()
        } catch (_: JsonProcessingException) {
            invalid()
        } catch (_: RuntimeException) {
            invalid()
        }
        requireObject(root, setOf("schemaVersion", "catalogVersion", "publishedAt", "assets"))
        val schemaVersion = exactInt(root, "schemaVersion", 1, 1)
        val catalogVersion = exactText(root, "catalogVersion").also {
            if (!version.matches(it) || it == "current") invalid()
        }
        val publishedAt = exactText(root, "publishedAt").also(::validateTimestamp)
        val assetNodes = root.required("assets")
        if (!assetNodes.isArray || assetNodes.size() !in 1..256) invalid()
        val descriptors = mutableMapOf<String, CatalogResourceDescriptor>()
        val assets = assetNodes.map { decodeAsset(it, descriptors) }
        requireSortedUnique(assets.map(CatalogAsset::assetId), "CATALOG_ASSETS_NOT_SORTED")
        return CatalogEnvelope(schemaVersion, catalogVersion, publishedAt, assets)
    }

    private fun decodeAsset(node: JsonNode, descriptors: MutableMap<String, CatalogResourceDescriptor>): CatalogAsset {
        requireObject(
            node,
            setOf(
                "assetId", "label", "section", "category", "anchorClass", "frontDirection",
                "dimensionsMm", "footprintMm", "resource", "thumbnail", "variantSlots",
            ),
            setOf(
                "assetId", "label", "section", "category", "anchorClass", "frontDirection",
                "dimensionsMm", "footprintMm", "resource", "variantSlots",
            ),
        )
        val assetId = exactText(node, "assetId").also { if (!identifier.matches(it)) invalid() }
        val label = label(node, "label")
        val section = exactText(node, "section").also { if (it !in sections) invalid() }
        val category = exactText(node, "category").also { if (it !in categories) invalid() }
        val anchorClass = exactText(node, "anchorClass").also { if (it !in setOf("floor", "wall")) invalid() }
        val frontDirection = exactText(node, "frontDirection").also { if (it != "positive-z") invalid() }
        val dimensions = dimensions(node.required("dimensionsMm"))
        val footprint = footprint(node.required("footprintMm"))
        if (dimensions.width != footprint.width || dimensions.depth != footprint.depth) {
            throw CatalogContractViolation("CATALOG_FOOTPRINT_MISMATCH")
        }
        val resource = resource(node.required("resource"), "model/gltf-binary", 26_214_400, descriptors)
        val thumbnail = node.get("thumbnail")?.let {
            resource(it, "image/png", 262_144, descriptors)
        }
        val slotNodes = node.required("variantSlots")
        if (!slotNodes.isArray || slotNodes.size() > 1) invalid()
        val slots = slotNodes.map { variantSlot(it, descriptors) }
        return CatalogAsset(
            assetId, label, section, category, anchorClass, frontDirection,
            dimensions, footprint, resource, thumbnail, slots,
        )
    }

    private fun dimensions(node: JsonNode): CatalogDimensions {
        requireObject(node, setOf("width", "depth", "height"))
        return CatalogDimensions(
            exactInt(node, "width", 1, 100_000),
            exactInt(node, "depth", 1, 100_000),
            exactInt(node, "height", 1, 100_000),
        )
    }

    private fun footprint(node: JsonNode): CatalogFootprint {
        requireObject(node, setOf("kind", "width", "depth"))
        val kind = exactText(node, "kind").also { if (it != "rectangle") invalid() }
        return CatalogFootprint(kind, exactInt(node, "width", 1, 100_000), exactInt(node, "depth", 1, 100_000))
    }

    private fun resource(
        node: JsonNode,
        mediaType: String,
        maximumBytes: Int,
        descriptors: MutableMap<String, CatalogResourceDescriptor>,
    ): CatalogResourceDescriptor {
        requireObject(node, setOf("sha256", "byteLength", "mediaType"))
        val hash = exactText(node, "sha256").also { if (!sha256.matches(it)) invalid() }
        val length = exactInt(node, "byteLength", 1, maximumBytes)
        val actualMediaType = exactText(node, "mediaType").also { if (it != mediaType) invalid() }
        val descriptor = CatalogResourceDescriptor(hash, length, actualMediaType)
        val previous = descriptors.putIfAbsent(hash, descriptor)
        if (previous != null && previous != descriptor) {
            throw CatalogContractViolation("CATALOG_RESOURCE_DESCRIPTOR_CONFLICT")
        }
        return descriptor
    }

    private fun variantSlot(
        node: JsonNode,
        descriptors: MutableMap<String, CatalogResourceDescriptor>,
    ): CatalogVariantSlot {
        requireObject(node, setOf("slotId", "label", "kind", "variants"))
        val slotId = exactText(node, "slotId").also { if (!identifier.matches(it)) invalid() }
        val slotLabel = label(node, "label")
        val kind = exactText(node, "kind").also { if (it != "model-resource") invalid() }
        val variantNodes = node.required("variants")
        if (!variantNodes.isArray || variantNodes.size() !in 1..32) invalid()
        val variants = variantNodes.map { variant(it, descriptors) }
        requireSortedUnique(variants.map(CatalogVariant::variantId), "CATALOG_VARIANTS_NOT_SORTED")
        return CatalogVariantSlot(slotId, slotLabel, kind, variants)
    }

    private fun variant(
        node: JsonNode,
        descriptors: MutableMap<String, CatalogResourceDescriptor>,
    ): CatalogVariant {
        requireObject(node, setOf("variantId", "label", "effect"))
        val variantId = exactText(node, "variantId").also { if (!identifier.matches(it)) invalid() }
        val variantLabel = label(node, "label")
        val effect = node.required("effect")
        requireObject(effect, setOf("kind", "resource"))
        if (exactText(effect, "kind") != "model-resource") invalid()
        return CatalogVariant(
            variantId,
            variantLabel,
            resource(effect.required("resource"), "model/gltf-binary", 26_214_400, descriptors),
        )
    }

    private fun label(node: JsonNode, field: String): String = exactText(node, field).also {
        val scalars = it.codePointCount(0, it.length)
        if (scalars !in 1..120) invalid()
        val utf8Bytes = try {
            StandardCharsets.UTF_8.newEncoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .encode(CharBuffer.wrap(it))
                .remaining()
        } catch (_: Exception) {
            invalid()
        }
        if (utf8Bytes > 240) {
            throw CatalogContractViolation("CATALOG_LABEL_UTF8_BYTES_LIMIT")
        }
        if (!Normalizer.isNormalized(it, Normalizer.Form.NFC)) {
            throw CatalogContractViolation("CATALOG_LABEL_NOT_NFC")
        }
    }

    private fun validateTimestamp(value: String) {
        if (!timestamp.matches(value)) invalid()
        try {
            OffsetDateTime.parse(value)
        } catch (_: DateTimeParseException) {
            throw CatalogContractViolation("CATALOG_TIMESTAMP_INVALID")
        }
    }

    private fun requireObject(node: JsonNode, allowed: Set<String>, required: Set<String> = allowed) {
        if (!node.isObject) invalid()
        val fields = node.fieldNames().asSequence().toSet()
        if (!fields.all(allowed::contains) || !required.all(fields::contains)) invalid()
    }

    private fun exactText(node: JsonNode, field: String): String = node.required(field).let {
        if (!it.isTextual) invalid()
        it.textValue()
    }

    private fun exactInt(node: JsonNode, field: String, minimum: Int, maximum: Int): Int = node.required(field).let {
        if (!it.isIntegralNumber || !it.canConvertToInt()) invalid()
        it.intValue().also { value -> if (value !in minimum..maximum) invalid() }
    }

    private fun JsonNode.required(field: String): JsonNode = get(field) ?: invalid()

    private fun requireSortedUnique(ids: List<String>, reasonCode: String) {
        if (ids != ids.sorted() || ids.toSet().size != ids.size) throw CatalogContractViolation(reasonCode)
    }

    private fun decodeUtf8(bytes: ByteArray): String = try {
        StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes))
            .toString()
    } catch (_: Exception) {
        invalid()
    }

    private fun hasUtf8Bom(bytes: ByteArray): Boolean =
        bytes.size >= 3 && bytes[0] == 0xef.toByte() && bytes[1] == 0xbb.toByte() && bytes[2] == 0xbf.toByte()

    private fun invalid(): Nothing = throw CatalogContractViolation("CATALOG_ENVELOPE_SCHEMA_INVALID")
}

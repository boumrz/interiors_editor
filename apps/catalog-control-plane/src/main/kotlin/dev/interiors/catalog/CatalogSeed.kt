package dev.interiors.catalog

import com.fasterxml.jackson.core.JsonFactory
import com.fasterxml.jackson.core.StreamReadFeature
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.security.MessageDigest

data class PreparedCatalogResource(
    val descriptor: CatalogResourceDescriptor,
    val bytes: ByteArray,
)

data class PreparedCatalogSeed(
    val envelope: CatalogEnvelope,
    val envelopeBytes: ByteArray,
    val envelopeHash: String,
    val resources: List<PreparedCatalogResource>,
)

object CatalogHash {
    fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
}

object CatalogJsonCanonicalizer {
    private val mapper = ObjectMapper(
        JsonFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build(),
    ).enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)

    fun canonicalize(source: ByteArray): ByteArray {
        val root = mapper.readTree(source)
        return buildString { appendCanonical(root, this) }.toByteArray(Charsets.UTF_8)
    }

    private fun appendCanonical(node: JsonNode, output: StringBuilder) {
        when {
            node.isObject -> {
                output.append('{')
                node.fieldNames().asSequence().toList().sorted().forEachIndexed { index, field ->
                    if (index > 0) output.append(',')
                    output.append(mapper.writeValueAsString(field)).append(':')
                    appendCanonical(node.required(field), output)
                }
                output.append('}')
            }
            node.isArray -> {
                output.append('[')
                node.forEachIndexed { index, child ->
                    if (index > 0) output.append(',')
                    appendCanonical(child, output)
                }
                output.append(']')
            }
            node.isTextual -> output.append(mapper.writeValueAsString(node.textValue()))
            node.isIntegralNumber -> output.append(node.asText())
            node.isBoolean -> output.append(if (node.booleanValue()) "true" else "false")
            node.isNull -> output.append("null")
            else -> throw CatalogContractViolation("CATALOG_ENVELOPE_SCHEMA_INVALID")
        }
    }

    private fun JsonNode.required(field: String): JsonNode = get(field)
        ?: throw CatalogContractViolation("CATALOG_ENVELOPE_SCHEMA_INVALID")
}

object CatalogSeedPreparer {
    private val mapper = ObjectMapper(
        JsonFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build(),
    ).enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
    private val fileName = Regex("^[a-z0-9-]+\\.(?:glb|png)$")

    fun prepare(envelopeSource: ByteArray, resourceMapSource: ByteArray, assetRoot: Path): PreparedCatalogSeed {
        val envelope = CatalogEnvelopeDecoder.decode(envelopeSource)
        val canonical = CatalogJsonCanonicalizer.canonicalize(envelopeSource)
        CatalogEnvelopeDecoder.decode(canonical)
        val descriptors = descriptors(envelope)
        val fileMap = decodeFileMap(resourceMapSource)
        if (fileMap.keys != descriptors.keys) {
            throw CatalogContractViolation("CATALOG_RESOURCE_MAP_MISMATCH")
        }
        val realRoot = assetRoot.toRealPath()
        val resources = descriptors.entries.sortedBy(Map.Entry<String, CatalogResourceDescriptor>::key).map { (hash, descriptor) ->
            val name = fileMap.getValue(hash)
            if (!fileName.matches(name)) throw CatalogContractViolation("CATALOG_RESOURCE_PATH_INVALID")
            val candidate = assetRoot.resolve(name)
            if (Files.isSymbolicLink(candidate) || !Files.isRegularFile(candidate, LinkOption.NOFOLLOW_LINKS)) {
                throw CatalogContractViolation("CATALOG_RESOURCE_PATH_INVALID")
            }
            val realPath = candidate.toRealPath()
            if (realPath.parent != realRoot) throw CatalogContractViolation("CATALOG_RESOURCE_PATH_INVALID")
            if (Files.size(realPath) != descriptor.byteLength.toLong()) {
                throw CatalogContractViolation("CATALOG_RESOURCE_INTEGRITY_MISMATCH")
            }
            val bytes = Files.readAllBytes(realPath)
            if (bytes.size != descriptor.byteLength || CatalogHash.sha256(bytes) != hash) {
                throw CatalogContractViolation("CATALOG_RESOURCE_INTEGRITY_MISMATCH")
            }
            CatalogMediaValidator.validate(descriptor.mediaType, bytes)
            PreparedCatalogResource(descriptor, bytes)
        }
        return PreparedCatalogSeed(envelope, canonical, CatalogHash.sha256(canonical), resources)
    }

    private fun descriptors(envelope: CatalogEnvelope): Map<String, CatalogResourceDescriptor> = buildMap {
        for (asset in envelope.assets) {
            putDescriptor(asset.resource)
            if (asset.thumbnail != null) putDescriptor(asset.thumbnail)
            for (slot in asset.variantSlots) for (variant in slot.variants) putDescriptor(variant.resource)
        }
    }

    private fun MutableMap<String, CatalogResourceDescriptor>.putDescriptor(descriptor: CatalogResourceDescriptor) {
        val previous = putIfAbsent(descriptor.sha256, descriptor)
        if (previous != null && previous != descriptor) {
            throw CatalogContractViolation("CATALOG_RESOURCE_DESCRIPTOR_CONFLICT")
        }
    }

    private fun decodeFileMap(source: ByteArray): Map<String, String> {
        val root = mapper.readTree(source)
        if (!root.isObject) throw CatalogContractViolation("CATALOG_RESOURCE_MAP_MISMATCH")
        return root.fields().asSequence().associate { (hash, value) ->
            if (!value.isTextual) throw CatalogContractViolation("CATALOG_RESOURCE_MAP_MISMATCH")
            hash to value.textValue()
        }
    }

}

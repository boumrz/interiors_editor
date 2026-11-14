package dev.interiors.catalog

import com.fasterxml.jackson.core.JsonFactory
import com.fasterxml.jackson.core.StreamReadFeature
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.util.zip.CRC32
import java.util.zip.DataFormatException
import java.util.zip.Inflater

/** Bounded structural admission for resources entering an immutable catalog publication. */
object CatalogMediaValidator {
    private const val GLB_MAGIC = 0x46546c67
    private const val GLB_VERSION = 2
    private const val JSON_CHUNK_TYPE = 0x4e4f534a
    private const val BIN_CHUNK_TYPE = 0x004e4942
    private const val MAX_GLB_BYTES = 26_214_400
    private val pngSignature = byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    private val allowedExtensions = setOf("KHR_materials_unlit", "KHR_texture_transform")
    private val mapper = ObjectMapper(
        JsonFactory.builder().enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build(),
    )

    fun validate(mediaType: String, bytes: ByteArray) {
        when (mediaType) {
            "image/png" -> validatePng(bytes)
            "model/gltf-binary" -> validateGlb(bytes)
            else -> reject()
        }
    }

    private fun validatePng(bytes: ByteArray) {
        if (bytes.size < 45 || !bytes.copyOfRange(0, 8).contentEquals(pngSignature)) reject()
        var offset = 8
        var ihdrCount = 0
        var idatCount = 0
        var iendCount = 0
        var width = 0
        var height = 0
        var channels = 0
        val compressed = ByteArrayOutputStream()

        while (offset < bytes.size) {
            if (bytes.size - offset < 12) reject()
            val lengthLong = unsignedInt(bytes, offset)
            if (lengthLong > Int.MAX_VALUE) reject()
            val length = lengthLong.toInt()
            val dataOffset = offset + 8
            val crcOffset = dataOffset.toLong() + length
            val endOffset = crcOffset + 4
            if (endOffset > bytes.size) reject()
            val type = String(bytes, offset + 4, 4, Charsets.US_ASCII)
            val crc = CRC32().apply { update(bytes, offset + 4, length + 4) }.value
            if (crc != unsignedInt(bytes, crcOffset.toInt())) {
                throw CatalogContractViolation("PNG_CRC_INVALID")
            }
            when (type) {
                "IHDR" -> {
                    if (offset != 8 || length != 13 || ++ihdrCount != 1) reject()
                    width = signedInt(bytes, dataOffset)
                    height = signedInt(bytes, dataOffset + 4)
                    val bitDepth = bytes[dataOffset + 8].toInt() and 0xff
                    val colorType = bytes[dataOffset + 9].toInt() and 0xff
                    channels = if (colorType == 2) 3 else if (colorType == 6) 4 else 0
                    if (
                        width !in 1..512 || height !in 1..512 || width.toLong() * height * 4 > 1_048_576 ||
                        bitDepth != 8 || channels == 0 || bytes[dataOffset + 10].toInt() != 0 ||
                        bytes[dataOffset + 11].toInt() != 0 || bytes[dataOffset + 12].toInt() != 0
                    ) reject()
                }
                "IDAT" -> {
                    if (ihdrCount != 1 || iendCount != 0) reject()
                    idatCount += 1
                    compressed.write(bytes, dataOffset, length)
                }
                "IEND" -> {
                    if (length != 0 || ihdrCount != 1 || idatCount == 0 || ++iendCount != 1 || endOffset != bytes.size.toLong()) {
                        reject()
                    }
                }
            }
            offset = endOffset.toInt()
        }
        if (ihdrCount != 1 || idatCount == 0 || iendCount != 1) reject()
        validateInflatedPng(compressed.toByteArray(), width, height, channels)
    }

    private fun validateInflatedPng(compressed: ByteArray, width: Int, height: Int, channels: Int) {
        val rowLength = 1 + width * channels
        val expectedLength = height * rowLength
        val output = ByteArray(expectedLength + 1)
        val inflater = Inflater()
        try {
            inflater.setInput(compressed)
            var written = 0
            while (!inflater.finished() && written < output.size) {
                val count = inflater.inflate(output, written, output.size - written)
                if (count == 0 && (inflater.needsInput() || inflater.needsDictionary())) break
                written += count
            }
            if (!inflater.finished() || written != expectedLength || inflater.remaining != 0) reject()
            for (row in 0 until height) if ((output[row * rowLength].toInt() and 0xff) !in 0..4) reject()
        } catch (_: DataFormatException) {
            reject()
        } finally {
            inflater.end()
        }
    }

    private fun validateGlb(bytes: ByteArray) {
        if (bytes.size !in 20..MAX_GLB_BYTES) reject()
        val view = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        if (view.int != GLB_MAGIC) reject()
        if (view.int != GLB_VERSION) throw CatalogContractViolation("GLB_VERSION_INVALID")
        if (view.int != bytes.size) reject()
        val jsonLength = view.int
        if (jsonLength <= 0 || jsonLength % 4 != 0 || view.int != JSON_CHUNK_TYPE || jsonLength > view.remaining()) reject()
        val jsonBytes = ByteArray(jsonLength).also(view::get)
        var binaryChunk: ByteArray? = null
        if (view.hasRemaining()) {
            if (view.remaining() < 8) reject()
            val binaryLength = view.int
            if (binaryLength < 0 || binaryLength % 4 != 0 || view.int != BIN_CHUNK_TYPE || binaryLength != view.remaining()) reject()
            binaryChunk = ByteArray(binaryLength).also(view::get)
        }
        if (view.hasRemaining()) reject()
        if (jsonBytes.any { it == 0.toByte() }) reject()
        val json = try {
            StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(jsonBytes)).toString().trimEnd(' ')
        } catch (_: Exception) {
            reject()
        }
        val document = try {
            mapper.readTree(json)
        } catch (_: Exception) {
            reject()
        }
        if (!document.isObject || document.path("asset").path("version").textValue() != "2.0") reject()
        validateStaticDocument(document, binaryChunk)
    }

    private fun validateStaticDocument(document: JsonNode, binaryChunk: ByteArray?) {
        if (document.has("animations") || document.has("skins") || document.has("cameras")) reject()
        for (buffer in array(document, "buffers")) if (buffer.has("uri")) reject()
        for (image in array(document, "images")) if (image.has("uri")) reject()
        for (node in array(document, "nodes")) if (node.has("camera") || node.has("skin")) reject()
        for (field in listOf("extensionsUsed", "extensionsRequired")) {
            for (extension in array(document, field)) {
                if (!extension.isTextual || extension.textValue() !in allowedExtensions) reject()
            }
        }
        if (array(document, "nodes").size > 256 || array(document, "materials").size > 32 || array(document, "textures").size > 16) {
            reject()
        }
        val accessors = array(document, "accessors")
        var primitives = 0
        var triangles = 0L
        val positionAccessors = mutableSetOf<Int>()
        for (mesh in array(document, "meshes")) {
            for (primitive in array(mesh, "primitives")) {
                primitives += 1
                val mode = if (primitive.has("mode")) primitive.path("mode").asInt(-1) else 4
                if (mode != 4) reject()
                val position = primitive.path("attributes").path("POSITION").asInt(-1)
                if (position !in accessors.indices) reject()
                positionAccessors += position
                val indices = primitive.path("indices").asInt(-1)
                val elementCount = if (indices >= 0) {
                    if (indices !in accessors.indices) reject()
                    accessorCount(accessors[indices])
                } else {
                    accessorCount(accessors[position])
                }
                if (elementCount % 3 != 0) reject()
                triangles += elementCount / 3
            }
        }
        if (primitives > 128 || triangles > 250_000) reject()
        val vertices = positionAccessors.sumOf { accessorCount(accessors[it]).toLong() }
        if (vertices > 300_000) reject()
        validateEmbeddedImages(document, binaryChunk)
    }

    private fun validateEmbeddedImages(document: JsonNode, binaryChunk: ByteArray?) {
        val bufferViews = array(document, "bufferViews")
        var totalPixels = 0L
        for (image in array(document, "images")) {
            val viewIndex = image.path("bufferView").asInt(-1)
            if (viewIndex !in bufferViews.indices || binaryChunk == null) reject()
            val bufferView = bufferViews[viewIndex]
            if (bufferView.path("buffer").asInt(-1) != 0) reject()
            val offset = if (bufferView.has("byteOffset")) bufferView.path("byteOffset").asInt(-1) else 0
            val length = bufferView.path("byteLength").asInt(-1)
            if (offset < 0 || length <= 0 || offset.toLong() + length > binaryChunk.size) reject()
            val imageBytes = binaryChunk.copyOfRange(offset, offset + length)
            val dimensions = imageDimensions(image.path("mimeType").textValue(), imageBytes) ?: reject()
            if (dimensions.first !in 1..4096 || dimensions.second !in 1..4096) reject()
            totalPixels += dimensions.first.toLong() * dimensions.second
            if (totalPixels > 48_000_000) reject()
        }
    }

    private fun imageDimensions(mimeType: String?, bytes: ByteArray): Pair<Int, Int>? = when (mimeType) {
        "image/png" -> if (bytes.size >= 24 && bytes.copyOfRange(0, 8).contentEquals(pngSignature)) {
            signedInt(bytes, 16) to signedInt(bytes, 20)
        } else null
        "image/jpeg" -> jpegDimensions(bytes)
        "image/webp" -> webpDimensions(bytes)
        else -> null
    }

    private fun jpegDimensions(bytes: ByteArray): Pair<Int, Int>? {
        if (bytes.size < 4 || bytes[0] != 0xff.toByte() || bytes[1] != 0xd8.toByte()) return null
        var offset = 2
        while (offset + 8 < bytes.size) {
            if (bytes[offset] != 0xff.toByte()) return null
            val marker = bytes[offset + 1].toInt() and 0xff
            if (marker in setOf(0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf)) {
                return unsignedShort(bytes, offset + 5) to unsignedShort(bytes, offset + 7)
            }
            if (offset + 4 > bytes.size) return null
            val length = unsignedShort(bytes, offset + 2)
            if (length < 2) return null
            offset += 2 + length
        }
        return null
    }

    private fun webpDimensions(bytes: ByteArray): Pair<Int, Int>? {
        if (bytes.size < 30 || String(bytes, 0, 4, Charsets.US_ASCII) != "RIFF" || String(bytes, 8, 4, Charsets.US_ASCII) != "WEBP") {
            return null
        }
        return when (String(bytes, 12, 4, Charsets.US_ASCII)) {
            "VP8X" -> (little24(bytes, 24) + 1) to (little24(bytes, 27) + 1)
            "VP8L" -> {
                if ((bytes[20].toInt() and 0xff) != 0x2f) return null
                val packed = littleInt(bytes, 21)
                ((packed and 0x3fff) + 1) to (((packed ushr 14) and 0x3fff) + 1)
            }
            "VP8 " -> {
                if (bytes.size < 30 || bytes[23] != 0x9d.toByte() || bytes[24] != 0x01.toByte() || bytes[25] != 0x2a.toByte()) return null
                (unsignedShortLittle(bytes, 26) and 0x3fff) to (unsignedShortLittle(bytes, 28) and 0x3fff)
            }
            else -> null
        }
    }

    private fun array(node: JsonNode, field: String): List<JsonNode> {
        val value = node.get(field) ?: return emptyList()
        if (!value.isArray) reject()
        return value.toList()
    }

    private fun accessorCount(accessor: JsonNode): Int {
        val count = accessor.path("count").asInt(-1)
        if (count < 0) reject()
        return count
    }

    private fun signedInt(bytes: ByteArray, offset: Int): Int = ByteBuffer.wrap(bytes, offset, 4).order(ByteOrder.BIG_ENDIAN).int
    private fun unsignedInt(bytes: ByteArray, offset: Int): Long = signedInt(bytes, offset).toLong() and 0xffff_ffffL
    private fun unsignedShort(bytes: ByteArray, offset: Int): Int =
        ((bytes[offset].toInt() and 0xff) shl 8) or (bytes[offset + 1].toInt() and 0xff)
    private fun unsignedShortLittle(bytes: ByteArray, offset: Int): Int =
        (bytes[offset].toInt() and 0xff) or ((bytes[offset + 1].toInt() and 0xff) shl 8)
    private fun little24(bytes: ByteArray, offset: Int): Int =
        (bytes[offset].toInt() and 0xff) or ((bytes[offset + 1].toInt() and 0xff) shl 8) or
            ((bytes[offset + 2].toInt() and 0xff) shl 16)
    private fun littleInt(bytes: ByteArray, offset: Int): Int = ByteBuffer.wrap(bytes, offset, 4).order(ByteOrder.LITTLE_ENDIAN).int

    private fun reject(): Nothing = throw CatalogContractViolation("CATALOG_RESOURCE_MEDIA_INVALID")
}

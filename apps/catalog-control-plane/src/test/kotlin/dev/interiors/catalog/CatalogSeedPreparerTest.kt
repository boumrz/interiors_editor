package dev.interiors.catalog

import com.fasterxml.jackson.databind.ObjectMapper
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermissions
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class CatalogSeedPreparerTest {
    private val mapper = ObjectMapper()

    @Test
    fun `reproduces the shared canonical golden bytes and etag`() {
        val source = Files.readAllBytes(fixtures.resolve("catalog-envelope-v1.valid.json"))
        val golden = mapper.readTree(Files.readAllBytes(fixtures.resolve("semantic-cases.json"))).required("canonicalGolden")

        val canonical = CatalogJsonCanonicalizer.canonicalize(source)

        assertEquals(golden.required("utf8").textValue(), canonical.toString(Charsets.UTF_8))
        assertEquals(golden.required("sha256").textValue(), CatalogHash.sha256(canonical))
    }

    @Test
    fun `prepares all curated alpha resources from the shared local root`() {
        val root = Files.createTempDirectory("catalog-curated-resource-root")
        try {
            for (source in listOf(sharedAssetRoot, evidenceAssetRoot)) {
                Files.list(source).use { files ->
                    files.filter { Files.isRegularFile(it) }.forEach { file ->
                        Files.copy(file, root.resolve(file.fileName.toString()))
                    }
                }
            }
            val prepared = CatalogSeedPreparer.prepare(
                envelopeSource = Files.readAllBytes(mainResources.resolve("catalog-envelope-source.json")),
                resourceMapSource = Files.readAllBytes(mainResources.resolve("catalog-resource-files-v1.json")),
                assetRoot = root,
            )

            assertEquals(12, prepared.envelope.assets.size)
            assertEquals(20, prepared.resources.size)
            assertEquals("alpha-2026-08-30.1", prepared.envelope.catalogVersion)
            assertEquals(
                setOf("furniture", "plumbing", "appliances-electronics", "lighting", "accessories"),
                prepared.envelope.assets.map(CatalogAsset::section).toSet(),
            )
            assertEquals(setOf("floor", "wall"), prepared.envelope.assets.map(CatalogAsset::anchorClass).toSet())
            assertEquals(
                "wall",
                prepared.envelope.assets.single { it.assetId == "evidence-wall-sconce" }.anchorClass,
            )
        } finally {
            Files.list(root).use { files -> files.forEach(Files::deleteIfExists) }
            Files.deleteIfExists(root)
        }
    }

    @Test
    fun `executes every shared media-profile fixture`() {
        val cases = mapper.readTree(Files.readAllBytes(fixtures.resolve("media-cases.json"))).required("cases")

        for (case in cases) {
            val bytes = Base64.getDecoder().decode(case.required("base64").textValue())
            val mediaType = if (case.required("profile").textValue().startsWith("CatalogThumbnail")) {
                "image/png"
            } else {
                "model/gltf-binary"
            }
            if (case.required("outcome").textValue() == "accepted") {
                CatalogMediaValidator.validate(mediaType, bytes)
            } else {
                val failure = assertFailsWith<CatalogContractViolation>(case.required("id").textValue()) {
                    CatalogMediaValidator.validate(mediaType, bytes)
                }
                assertEquals(case.required("reasonCode").textValue(), failure.reasonCode)
            }
        }
    }

    @Test
    fun `rejects NUL padding in the GLB JSON chunk`() {
        val accepted = Base64.getDecoder().decode(
            "Z2xURgIAAAAwAAAAHAAAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAifX0g",
        )
        val nulPadded = accepted.copyOf().also { it[it.lastIndex] = 0 }

        assertEquals(
            "CATALOG_RESOURCE_MEDIA_INVALID",
            kotlin.test.assertFailsWith<CatalogContractViolation> {
                CatalogMediaValidator.validate("model/gltf-binary", nulPadded)
            }.reasonCode,
        )
    }

    @Test
    fun `rejects a mapped size mismatch before opening resource bytes`() {
        val root = Files.createTempDirectory("catalog-size-check")
        val file = root.resolve("single-bed.glb")
        Files.write(file, byteArrayOf(1, 2))
        val candidate = mapper.readTree(Files.readAllBytes(fixtures.resolve("catalog-envelope-v1.valid.json")))
        candidate.at("/assets/0/resource").apply {
            (this as com.fasterxml.jackson.databind.node.ObjectNode)
                .put("sha256", "0".repeat(64))
                .put("byteLength", 1)
        }
        (candidate.at("/assets/0") as com.fasterxml.jackson.databind.node.ObjectNode).remove("thumbnail")
        Files.setPosixFilePermissions(file, emptySet())

        try {
            val failure = assertFailsWith<CatalogContractViolation> {
                CatalogSeedPreparer.prepare(
                    envelopeSource = mapper.writeValueAsBytes(candidate),
                    resourceMapSource = mapper.writeValueAsBytes(mapOf("0".repeat(64) to file.fileName.toString())),
                    assetRoot = root,
                )
            }
            assertEquals("CATALOG_RESOURCE_INTEGRITY_MISMATCH", failure.reasonCode)
        } finally {
            Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"))
            Files.deleteIfExists(file)
            Files.deleteIfExists(root)
        }
    }

    @Test
    fun `rejects hash-correct resource bytes outside the adopted media profile`() {
        val root = Files.createTempDirectory("catalog-media-check")
        val file = root.resolve("single-bed.glb")
        val bytes = Base64.getDecoder().decode(
            "Z2xURgIAAABAAAAALAAAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAifSwiYW5pbWF0aW9ucyI6W119IA==",
        )
        Files.write(file, bytes)
        val hash = CatalogHash.sha256(bytes)
        val candidate = mapper.readTree(Files.readAllBytes(fixtures.resolve("catalog-envelope-v1.valid.json")))
        (candidate.at("/assets/0/resource") as com.fasterxml.jackson.databind.node.ObjectNode)
            .put("sha256", hash)
            .put("byteLength", bytes.size)
        (candidate.at("/assets/0") as com.fasterxml.jackson.databind.node.ObjectNode).remove("thumbnail")

        try {
            assertEquals(
                "CATALOG_RESOURCE_MEDIA_INVALID",
                assertFailsWith<CatalogContractViolation> {
                    CatalogSeedPreparer.prepare(
                        envelopeSource = mapper.writeValueAsBytes(candidate),
                        resourceMapSource = mapper.writeValueAsBytes(mapOf(hash to file.fileName.toString())),
                        assetRoot = root,
                    )
                }.reasonCode,
            )
        } finally {
            Files.deleteIfExists(file)
            Files.deleteIfExists(root)
        }
    }

    private fun com.fasterxml.jackson.databind.JsonNode.required(field: String) =
        get(field) ?: error("Missing fixture field: $field")

    private companion object {
        val fixtures: Path = Path.of("../../contracts/catalog-control-plane/fixtures")
        val mainResources: Path = Path.of("src/main/resources/catalog")
        val sharedAssetRoot: Path = Path.of("../web/public/catalog")
        val evidenceAssetRoot: Path = mainResources.resolve("evidence-assets")
    }
}

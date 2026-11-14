package dev.interiors.catalog

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import org.postgresql.ds.PGSimpleDataSource
import org.testcontainers.containers.PostgreSQLContainer
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.sql.Connection
import java.sql.DriverManager
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class JdbcCatalogRepositoryIntegrationTest {
    private val database = PostgreSQLContainer("postgres:18.4")
        .withDatabaseName("catalog")
        .withUsername("postgres")
        .withPassword("postgres-test")

    @BeforeTest
    fun startDatabase() {
        database.start()
        adminWithRetry().use { connection ->
            connection.execute(script("catalog-operator-bootstrap-v1.sql"))
            connection.execute(
                "ALTER ROLE catalog_migrate PASSWORD 'migrate-test';" +
                    "ALTER ROLE catalog_publish PASSWORD 'publish-test';" +
                    "ALTER ROLE catalog_runtime PASSWORD 'runtime-test';",
            )
        }
        connection("catalog_migrate", "migrate-test").use {
            it.execute(script("catalog-schema-v1.sql"))
        }
    }

    @AfterTest
    fun stopDatabase() {
        database.stop()
    }

    @Test
    fun `reads exact current version and resource through the runtime role`() {
        val envelope = Files.readAllBytes(fixtures.resolve("catalog-envelope-v1.valid.json"))
        val envelopeHash = sha256(envelope)
        val resourceBytes = byteArrayOf(0x67, 0x6c, 0x54, 0x46)
        val resourceHash = sha256(resourceBytes)
        publish(envelope, envelopeHash, resourceBytes, resourceHash)

        val repository = JdbcCatalogRepository(dataSource("catalog_runtime", "runtime-test"))

        assertContentEquals(envelope, repository.currentPublication()?.envelopeBytes)
        assertEquals("alpha-2026-08-26.1", repository.publication("alpha-2026-08-26.1")?.catalogVersion)
        assertContentEquals(resourceBytes, repository.resourceBytes(resourceHash, 0, resourceBytes.lastIndex))
        assertContentEquals(resourceBytes.copyOfRange(1, 3), repository.resourceBytes(resourceHash, 1, 2))
    }

    @Test
    fun `runtime cannot write and publisher cannot mutate immutable publication rows`() {
        val envelope = Files.readAllBytes(fixtures.resolve("catalog-envelope-v1.valid.json"))
        val resourceBytes = byteArrayOf(0x67, 0x6c, 0x54, 0x46)
        publish(envelope, sha256(envelope), resourceBytes, sha256(resourceBytes))

        assertFails {
            connection("catalog_runtime", "runtime-test").use {
                it.execute("DELETE FROM catalog_data.catalog_publication")
            }
        }
        assertFails {
            connection("catalog_publish", "publish-test").use {
                it.execute("UPDATE catalog_data.catalog_publication SET asset_count = 2")
            }
        }
        assertFails {
            connection("catalog_runtime", "runtime-test").use {
                it.execute("CREATE TEMP TABLE project_payload(project_id text)")
            }
        }

        admin().use { connection ->
            val prohibited = connection.prepareStatement(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'catalog_data'
                  AND column_name ~ '(project|revision|history|backup|account|user|upload)'
                """.trimIndent(),
            ).executeQuery()
            assertEquals(false, prohibited.next())
            assertFalse(connection.boolean("SELECT has_database_privilege('public', current_database(), 'CONNECT')"))
            assertFalse(connection.boolean("SELECT has_database_privilege('public', current_database(), 'TEMPORARY')"))
            assertTrue(connection.boolean("SELECT has_database_privilege('catalog_runtime', current_database(), 'CONNECT')"))
        }
    }

    @Test
    fun `runtime readiness rejects elevated identities and an incomplete current publication`() {
        val envelope = Files.readAllBytes(fixtures.resolve("catalog-envelope-v1.valid.json"))
        val resourceBytes = byteArrayOf(0x67, 0x6c, 0x54, 0x46)
        publish(envelope, sha256(envelope), resourceBytes, sha256(resourceBytes))

        val runtime = JdbcCatalogRepository(dataSource("catalog_runtime", "runtime-test"))
        runtime.verifyRuntimeBoundary()
        assertEquals(
            "CATALOG_CURRENT_INCOMPLETE",
            assertFailsWith<CatalogContractViolation> { runtime.requireReadyCurrentPublication() }.reasonCode,
        )

        val publisher = JdbcCatalogRepository(dataSource("catalog_publish", "publish-test"))
        assertEquals(
            "CATALOG_RUNTIME_AUTHORITY_INVALID",
            assertFailsWith<CatalogContractViolation> { publisher.verifyRuntimeBoundary() }.reasonCode,
        )
    }

    @Test
    fun `publishes the complete curated alpha catalog atomically`() {
        val prepared = preparedCuratedCatalog()

        CatalogPublisher(dataSource("catalog_publish", "publish-test")).publish(prepared)

        val repository = JdbcCatalogRepository(dataSource("catalog_runtime", "runtime-test"))
        repository.verifyRuntimeBoundary()
        val stored = repository.requireReadyCurrentPublication()
        assertEquals(prepared.envelope, CatalogEnvelopeDecoder.decode(stored.envelopeBytes))
        admin().use { connection ->
            assertEquals(20, connection.scalarInt("SELECT count(*) FROM catalog_data.catalog_resource"))
            assertEquals(12, connection.scalarInt("SELECT count(*) FROM catalog_data.catalog_asset"))
            assertExactCatalogDataSchema(connection)
            assertNormalizedProjection(connection, prepared.envelope)
        }
    }

    @Test
    fun `readiness independently detects publication normalized-row and exact-resource corruption`() {
        val prepared = preparedCuratedCatalog()
        CatalogPublisher(dataSource("catalog_publish", "publish-test")).publish(prepared)
        val repository = JdbcCatalogRepository(dataSource("catalog_runtime", "runtime-test"))
        val version = prepared.envelope.catalogVersion

        admin().use { connection ->
            connection.execute(
                "UPDATE catalog_data.catalog_publication SET published_at = published_at + interval '1 second' " +
                    "WHERE catalog_version = '$version'",
            )
        }
        assertIncomplete(repository)
        admin().use { connection ->
            connection.execute(
                "UPDATE catalog_data.catalog_publication SET published_at = '${prepared.envelope.publishedAt}' " +
                    "WHERE catalog_version = '$version'",
            )
            connection.execute(
                "UPDATE catalog_data.catalog_asset SET label = 'Corrupt' " +
                    "WHERE catalog_version = '$version' AND asset_id = '${prepared.envelope.assets.first().assetId}'",
            )
        }
        assertIncomplete(repository)
        admin().use { connection ->
            connection.prepareStatement(
                "UPDATE catalog_data.catalog_asset SET label = ? WHERE catalog_version = ? AND asset_id = ?",
            ).use { statement ->
                statement.setString(1, prepared.envelope.assets.first().label)
                statement.setString(2, version)
                statement.setString(3, prepared.envelope.assets.first().assetId)
                statement.executeUpdate()
            }
            val resource = prepared.resources.first()
            connection.prepareStatement(
                "UPDATE catalog_data.catalog_resource SET resource_bytes = set_byte(resource_bytes, 0, (get_byte(resource_bytes, 0) + 1) % 256) WHERE resource_hash = ?",
            ).use { statement ->
                statement.setString(1, resource.descriptor.sha256)
                statement.executeUpdate()
            }
        }
        assertIncomplete(repository)
    }

    @Test
    fun `publisher and readiness preserve one complete model-resource variant`() {
        val prepared = preparedCuratedCatalogWithVariant()
        CatalogPublisher(dataSource("catalog_publish", "publish-test")).publish(prepared)
        val repository = JdbcCatalogRepository(dataSource("catalog_runtime", "runtime-test"))

        assertEquals(prepared.envelope.catalogVersion, repository.requireReadyCurrentPublication().catalogVersion)
        admin().use { connection ->
            assertEquals(1, connection.scalarInt("SELECT count(*) FROM catalog_data.catalog_variant_slot"))
            assertEquals(1, connection.scalarInt("SELECT count(*) FROM catalog_data.catalog_variant_option"))
            connection.execute("DELETE FROM catalog_data.catalog_variant_option")
        }
        assertIncomplete(repository)
    }

    @Test
    fun `readiness rejects hash-correct bytes outside the adopted media profile`() {
        val invalidBytes = java.util.Base64.getDecoder().decode(
            "Z2xURgIAAABAAAAALAAAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAifSwiYW5pbWF0aW9ucyI6W119IA==",
        )
        val hash = sha256(invalidBytes)
        val mapper = ObjectMapper()
        val candidate = mapper.readTree(Files.readAllBytes(fixtures.resolve("catalog-envelope-v1.valid.json"))) as ObjectNode
        (candidate.at("/assets/0/resource") as ObjectNode)
            .put("sha256", hash)
            .put("byteLength", invalidBytes.size)
        (candidate.at("/assets/0") as ObjectNode).remove("thumbnail")
        val canonical = CatalogJsonCanonicalizer.canonicalize(mapper.writeValueAsBytes(candidate))
        val envelope = CatalogEnvelopeDecoder.decode(canonical)
        val descriptor = envelope.assets.single().resource
        CatalogPublisher(dataSource("catalog_publish", "publish-test")).publish(
            PreparedCatalogSeed(
                envelope = envelope,
                envelopeBytes = canonical,
                envelopeHash = sha256(canonical),
                resources = listOf(PreparedCatalogResource(descriptor, invalidBytes)),
            ),
        )

        assertIncomplete(JdbcCatalogRepository(dataSource("catalog_runtime", "runtime-test")))
    }

    private fun assertExactCatalogDataSchema(connection: Connection) {
        val expected = linkedMapOf(
            "catalog_asset" to listOf(
                "catalog_version", "asset_id", "label", "section", "category", "anchor_class", "front_direction",
                "width_mm", "depth_mm", "height_mm", "footprint_width_mm", "footprint_depth_mm", "model_hash",
                "thumbnail_hash",
            ),
            "catalog_current" to listOf("singleton", "catalog_version"),
            "catalog_publication" to listOf(
                "catalog_version", "published_at", "envelope_hash", "envelope_bytes", "asset_count",
            ),
            "catalog_resource" to listOf("resource_hash", "byte_length", "media_type", "resource_bytes"),
            "catalog_variant_option" to listOf(
                "catalog_version", "asset_id", "slot_id", "variant_id", "label", "model_hash",
            ),
            "catalog_variant_slot" to listOf("catalog_version", "asset_id", "slot_id", "label", "slot_kind"),
        )
        val actual = linkedMapOf<String, MutableList<String>>()
        connection.prepareStatement(
            """
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'catalog_data'
            ORDER BY table_name, ordinal_position
            """.trimIndent(),
        ).executeQuery().use { rows ->
            while (rows.next()) actual.getOrPut(rows.getString(1)) { mutableListOf() }.add(rows.getString(2))
        }
        assertEquals(expected, actual.mapValues { (_, columns) -> columns.toList() })
        assertEquals(
            0,
            connection.scalarInt(
                """
                SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'catalog_data' AND c.relkind IN ('S', 'v', 'm', 'f', 'p')
                """.trimIndent(),
            ),
        )
        assertEquals(
            0,
            connection.scalarInt(
                """
                SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'catalog_data'
                """.trimIndent(),
            ),
        )
        assertEquals(
            0,
            connection.scalarInt(
                """
                SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'catalog_data' AND NOT t.tgisinternal
                """.trimIndent(),
            ),
        )
        connection.createStatement().executeQuery(
            "SELECT has_schema_privilege('catalog_runtime', 'catalog_migration', 'USAGE')",
        ).use { rows ->
            check(rows.next())
            assertFalse(rows.getBoolean(1))
        }
    }

    private fun assertNormalizedProjection(connection: Connection, envelope: CatalogEnvelope) {
        assertEquals(envelope.assets.size, connection.scalarInt("SELECT count(*) FROM catalog_data.catalog_asset"))
        for (asset in envelope.assets) {
            connection.prepareStatement(
                """
                SELECT a.label, a.section, a.category, a.anchor_class, a.front_direction,
                       a.width_mm, a.depth_mm, a.height_mm, a.footprint_width_mm, a.footprint_depth_mm,
                       a.model_hash, model.byte_length, model.media_type,
                       a.thumbnail_hash, thumbnail.byte_length, thumbnail.media_type
                FROM catalog_data.catalog_asset a
                JOIN catalog_data.catalog_resource model ON model.resource_hash = a.model_hash
                LEFT JOIN catalog_data.catalog_resource thumbnail ON thumbnail.resource_hash = a.thumbnail_hash
                WHERE a.catalog_version = ? AND a.asset_id = ?
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, envelope.catalogVersion)
                statement.setString(2, asset.assetId)
                statement.executeQuery().use { row ->
                    check(row.next())
                    assertEquals(asset.label, row.getString(1))
                    assertEquals(asset.section, row.getString(2))
                    assertEquals(asset.category, row.getString(3))
                    assertEquals(asset.anchorClass, row.getString(4))
                    assertEquals(asset.frontDirection, row.getString(5))
                    assertEquals(asset.dimensionsMm.width, row.getInt(6))
                    assertEquals(asset.dimensionsMm.depth, row.getInt(7))
                    assertEquals(asset.dimensionsMm.height, row.getInt(8))
                    assertEquals(asset.footprintMm.width, row.getInt(9))
                    assertEquals(asset.footprintMm.depth, row.getInt(10))
                    assertEquals(asset.resource.sha256, row.getString(11).trim())
                    assertEquals(asset.resource.byteLength, row.getInt(12))
                    assertEquals(asset.resource.mediaType, row.getString(13))
                    if (asset.thumbnail == null) {
                        assertNull(row.getString(14))
                    } else {
                        assertEquals(asset.thumbnail.sha256, row.getString(14).trim())
                        assertEquals(asset.thumbnail.byteLength, row.getInt(15))
                        assertEquals(asset.thumbnail.mediaType, row.getString(16))
                    }
                    assertFalse(row.next())
                }
            }
            assertNormalizedVariants(connection, envelope.catalogVersion, asset)
        }
    }

    private fun assertNormalizedVariants(connection: Connection, version: String, asset: CatalogAsset) {
        connection.prepareStatement(
            """
            SELECT slot.slot_id, slot.label, slot.slot_kind,
                   option.variant_id, option.label, option.model_hash, resource.byte_length, resource.media_type
            FROM catalog_data.catalog_variant_slot slot
            JOIN catalog_data.catalog_variant_option option
              USING (catalog_version, asset_id, slot_id)
            JOIN catalog_data.catalog_resource resource ON resource.resource_hash = option.model_hash
            WHERE slot.catalog_version = ? AND slot.asset_id = ?
            ORDER BY slot.slot_id, option.variant_id
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, version)
            statement.setString(2, asset.assetId)
            statement.executeQuery().use { rows ->
                val expected = asset.variantSlots.flatMap { slot -> slot.variants.map { slot to it } }
                for ((slot, variant) in expected) {
                    check(rows.next())
                    assertEquals(slot.slotId, rows.getString(1))
                    assertEquals(slot.label, rows.getString(2))
                    assertEquals(slot.kind, rows.getString(3))
                    assertEquals(variant.variantId, rows.getString(4))
                    assertEquals(variant.label, rows.getString(5))
                    assertEquals(variant.resource.sha256, rows.getString(6).trim())
                    assertEquals(variant.resource.byteLength, rows.getInt(7))
                    assertEquals(variant.resource.mediaType, rows.getString(8))
                }
                assertFalse(rows.next())
            }
        }
    }

    private fun publish(envelope: ByteArray, envelopeHash: String, resourceBytes: ByteArray, resourceHash: String) {
        connection("catalog_publish", "publish-test").use { connection ->
            connection.autoCommit = false
            connection.prepareStatement(
                "INSERT INTO catalog_data.catalog_resource(resource_hash, byte_length, media_type, resource_bytes) VALUES (?, ?, ?, ?)",
            ).use {
                it.setString(1, resourceHash)
                it.setInt(2, resourceBytes.size)
                it.setString(3, "model/gltf-binary")
                it.setBytes(4, resourceBytes)
                it.executeUpdate()
            }
            connection.prepareStatement(
                "INSERT INTO catalog_data.catalog_publication(catalog_version, published_at, envelope_hash, envelope_bytes, asset_count) VALUES (?, ?, ?, ?, ?)",
            ).use {
                it.setString(1, "alpha-2026-08-26.1")
                it.setObject(2, java.time.OffsetDateTime.parse("2026-08-26T00:00:00Z"))
                it.setString(3, envelopeHash)
                it.setBytes(4, envelope)
                it.setInt(5, 1)
                it.executeUpdate()
            }
            connection.execute("INSERT INTO catalog_data.catalog_current(singleton, catalog_version) VALUES (true, 'alpha-2026-08-26.1')")
            connection.commit()
        }
    }

    private fun preparedCuratedCatalog(): PreparedCatalogSeed {
        val root = Files.createTempDirectory("catalog-curated-resource-root")
        try {
            for (source in listOf(Path.of("../web/public/catalog"), Path.of("src/main/resources/catalog/evidence-assets"))) {
                Files.list(source).use { files ->
                    files.filter { Files.isRegularFile(it) }.forEach { file ->
                        Files.copy(file, root.resolve(file.fileName.toString()))
                    }
                }
            }
            return CatalogSeedPreparer.prepare(
                envelopeSource = Files.readAllBytes(Path.of("src/main/resources/catalog/catalog-envelope-source.json")),
                resourceMapSource = Files.readAllBytes(Path.of("src/main/resources/catalog/catalog-resource-files-v1.json")),
                assetRoot = root,
            )
        } finally {
            Files.list(root).use { files -> files.forEach(Files::deleteIfExists) }
            Files.deleteIfExists(root)
        }
    }

    private fun preparedCuratedCatalogWithVariant(): PreparedCatalogSeed {
        val mapper = ObjectMapper()
        val candidate = mapper.readTree(
            Files.readAllBytes(Path.of("src/main/resources/catalog/catalog-envelope-source.json")),
        ) as ObjectNode
        candidate.put("catalogVersion", "alpha-2026-08-26.2")
        candidate.put("publishedAt", "2026-08-26T01:00:00Z")
        val assets = candidate.withArray("assets")
        val asset = assets.first() as ObjectNode
        val descriptor = assets[1].required("resource").deepCopy<com.fasterxml.jackson.databind.JsonNode>()
        while (assets.size() > 1) assets.remove(assets.size() - 1)
        val resourceMap = mapper.readTree(
            Files.readAllBytes(Path.of("src/main/resources/catalog/catalog-resource-files-v1.json")),
        ) as ObjectNode
        val requiredHashes = setOf(
            asset.required("resource").required("sha256").textValue(),
            asset.required("thumbnail").required("sha256").textValue(),
            descriptor.required("sha256").textValue(),
        )
        resourceMap.fieldNames().asSequence().toList()
            .filterNot(requiredHashes::contains)
            .forEach(resourceMap::remove)
        val variant = mapper.createObjectNode().apply {
            put("variantId", "standard")
            put("label", "Стандарт")
            set<ObjectNode>("effect", mapper.createObjectNode().apply {
                put("kind", "model-resource")
                set<com.fasterxml.jackson.databind.JsonNode>("resource", descriptor)
            })
        }
        val slot = mapper.createObjectNode().apply {
            put("slotId", "model")
            put("label", "Модель")
            put("kind", "model-resource")
            set<ArrayNode>("variants", mapper.createArrayNode().add(variant))
        }
        asset.set<ArrayNode>("variantSlots", mapper.createArrayNode().add(slot))
        return CatalogSeedPreparer.prepare(
            envelopeSource = mapper.writeValueAsBytes(candidate),
            resourceMapSource = mapper.writeValueAsBytes(resourceMap),
            assetRoot = Path.of("../web/public/catalog"),
        )
    }

    private fun assertIncomplete(repository: JdbcCatalogRepository) {
        assertEquals(
            "CATALOG_CURRENT_INCOMPLETE",
            assertFailsWith<CatalogContractViolation> { repository.requireReadyCurrentPublication() }.reasonCode,
        )
    }

    private fun com.fasterxml.jackson.databind.JsonNode.required(field: String) =
        get(field) ?: error("Missing fixture field: $field")

    private fun dataSource(user: String, password: String) = PGSimpleDataSource().apply {
        setURL(database.jdbcUrl)
        this.user = user
        this.password = password
    }

    private fun admin(): Connection = DriverManager.getConnection(database.jdbcUrl, database.username, database.password)
    private fun adminWithRetry(): Connection {
        var lastFailure: Exception? = null
        repeat(50) {
            try {
                return admin()
            } catch (failure: Exception) {
                lastFailure = failure
                Thread.sleep(100)
            }
        }
        throw lastFailure ?: IllegalStateException("PostgreSQL did not become reachable")
    }
    private fun connection(user: String, password: String): Connection = DriverManager.getConnection(database.jdbcUrl, user, password)
    private fun Connection.execute(sql: String) = createStatement().use { it.execute(sql) }
    private fun Connection.scalarInt(sql: String): Int = createStatement().use { statement ->
        statement.executeQuery(sql).use { result ->
            check(result.next())
            result.getInt(1)
        }
    }
    private fun Connection.boolean(sql: String): Boolean = createStatement().use { statement ->
        statement.executeQuery(sql).use { result ->
            check(result.next())
            result.getBoolean(1)
        }
    }
    private fun script(name: String): String = Files.readString(contracts.resolve(name))
    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    private companion object {
        val contracts: Path = Path.of("../../contracts/catalog-control-plane")
        val fixtures: Path = contracts.resolve("fixtures")
    }
}

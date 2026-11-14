package dev.interiors.catalog

import java.sql.ResultSet
import java.time.OffsetDateTime
import javax.sql.DataSource

class JdbcCatalogRepository(private val dataSource: DataSource) : CatalogReadRepository {
    fun verifyRuntimeBoundary() {
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                SELECT current_user,
                       role.rolsuper, role.rolcreatedb, role.rolcreaterole,
                       role.rolinherit, role.rolreplication, role.rolbypassrls,
                       has_database_privilege(current_user, current_database(), 'TEMPORARY'),
                       has_schema_privilege(current_user, 'catalog_data', 'CREATE'),
                       has_schema_privilege(current_user, 'catalog_migration', 'USAGE'),
                       (SELECT count(*) = 6
                        FROM information_schema.role_table_grants grants
                        WHERE grants.grantee = current_user
                          AND grants.table_schema = 'catalog_data'
                          AND grants.privilege_type = 'SELECT'),
                       NOT EXISTS (
                         SELECT 1 FROM information_schema.role_table_grants grants
                         WHERE grants.grantee = current_user
                           AND grants.table_schema = 'catalog_data'
                           AND grants.privilege_type <> 'SELECT'
                       )
                FROM pg_roles role
                WHERE role.rolname = current_user
                """.trimIndent(),
            ).executeQuery().use { row ->
                val valid = row.next() &&
                    row.getString(1) == "catalog_runtime" &&
                    !row.getBoolean(2) &&
                    !row.getBoolean(3) &&
                    !row.getBoolean(4) &&
                    !row.getBoolean(5) &&
                    !row.getBoolean(6) &&
                    !row.getBoolean(7) &&
                    !row.getBoolean(8) &&
                    !row.getBoolean(9) &&
                    !row.getBoolean(10) &&
                    row.getBoolean(11) &&
                    row.getBoolean(12) &&
                    !row.next()
                if (!valid) throw CatalogContractViolation("CATALOG_RUNTIME_AUTHORITY_INVALID")
            }
        }
    }

    fun requireReadyCurrentPublication(): StoredCatalogPublication {
        val publication = currentPublication() ?: incomplete()
        val envelope = try {
            CatalogEnvelopeDecoder.decode(publication.envelopeBytes)
        } catch (_: CatalogContractViolation) {
            incomplete()
        }
        if (
            publication.catalogVersion != envelope.catalogVersion ||
            publication.envelopeHash != CatalogHash.sha256(publication.envelopeBytes)
        ) incomplete()

        verifyPublicationRow(publication.catalogVersion, envelope)
        verifyNormalizedAssets(envelope)
        verifyResources(envelope)
        return publication
    }

    override fun currentPublication(): StoredCatalogPublication? = dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
            SELECT p.catalog_version, p.envelope_hash, p.envelope_bytes
            FROM catalog_data.catalog_current c
            JOIN catalog_data.catalog_publication p USING (catalog_version)
            WHERE c.singleton = true
            """.trimIndent(),
        ).use { statement -> statement.executeQuery().use(::singlePublication) }
    }

    override fun publication(version: String): StoredCatalogPublication? = dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
            SELECT catalog_version, envelope_hash, envelope_bytes
            FROM catalog_data.catalog_publication
            WHERE catalog_version = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, version)
            statement.executeQuery().use(::singlePublication)
        }
    }

    override fun resourceMetadata(hash: String): StoredCatalogResourceMetadata? = dataSource.connection.use { connection ->
        connection.prepareStatement(
            """
            SELECT resource_hash, media_type, byte_length
            FROM catalog_data.catalog_resource
            WHERE resource_hash = ?
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, hash)
            statement.executeQuery().use { results ->
                if (!results.next()) null else StoredCatalogResourceMetadata(
                    resourceHash = results.getString("resource_hash").trim(),
                    mediaType = results.getString("media_type"),
                    byteLength = results.getInt("byte_length"),
                )
            }
        }
    }

    override fun resourceBytes(hash: String, startInclusive: Int, endInclusive: Int): ByteArray? =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                SELECT substring(resource_bytes FROM ? FOR ?)
                FROM catalog_data.catalog_resource
                WHERE resource_hash = ?
                """.trimIndent(),
            ).use { statement ->
                statement.setInt(1, startInclusive + 1)
                statement.setInt(2, endInclusive - startInclusive + 1)
                statement.setString(3, hash)
                statement.executeQuery().use { results -> if (results.next()) results.getBytes(1) else null }
            }
        }

    private fun singlePublication(results: ResultSet): StoredCatalogPublication? =
        if (!results.next()) null else StoredCatalogPublication(
            catalogVersion = results.getString("catalog_version"),
            envelopeHash = results.getString("envelope_hash").trim(),
            envelopeBytes = results.getBytes("envelope_bytes"),
        )

    private fun verifyPublicationRow(version: String, envelope: CatalogEnvelope) {
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                SELECT published_at, asset_count
                FROM catalog_data.catalog_publication
                WHERE catalog_version = ?
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, version)
                statement.executeQuery().use { row ->
                    if (
                        !row.next() ||
                        row.getObject("published_at", OffsetDateTime::class.java).toInstant() !=
                        OffsetDateTime.parse(envelope.publishedAt).toInstant() ||
                        row.getInt("asset_count") != envelope.assets.size ||
                        row.next()
                    ) incomplete()
                }
            }
        }
    }

    private fun verifyNormalizedAssets(envelope: CatalogEnvelope) {
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                SELECT asset_id, label, section, category, anchor_class, front_direction,
                       width_mm, depth_mm, height_mm, footprint_width_mm, footprint_depth_mm,
                       model_hash, thumbnail_hash
                FROM catalog_data.catalog_asset
                WHERE catalog_version = ?
                ORDER BY asset_id
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, envelope.catalogVersion)
                statement.executeQuery().use { rows ->
                    for (asset in envelope.assets) {
                        if (!rows.next() || !assetMatches(rows, asset)) incomplete()
                        verifyVariants(connection, envelope.catalogVersion, asset)
                    }
                    if (rows.next()) incomplete()
                }
            }
        }
    }

    private fun assetMatches(row: ResultSet, asset: CatalogAsset): Boolean =
        row.getString("asset_id") == asset.assetId &&
            row.getString("label") == asset.label &&
            row.getString("section") == asset.section &&
            row.getString("category") == asset.category &&
            row.getString("anchor_class") == asset.anchorClass &&
            row.getString("front_direction") == asset.frontDirection &&
            row.getInt("width_mm") == asset.dimensionsMm.width &&
            row.getInt("depth_mm") == asset.dimensionsMm.depth &&
            row.getInt("height_mm") == asset.dimensionsMm.height &&
            row.getInt("footprint_width_mm") == asset.footprintMm.width &&
            row.getInt("footprint_depth_mm") == asset.footprintMm.depth &&
            row.getString("model_hash").trim() == asset.resource.sha256 &&
            row.getString("thumbnail_hash")?.trim() == asset.thumbnail?.sha256

    private fun verifyVariants(connection: java.sql.Connection, version: String, asset: CatalogAsset) {
        connection.prepareStatement(
            """
            SELECT slot.slot_id, slot.label AS slot_label, slot.slot_kind,
                   option.variant_id, option.label AS variant_label, option.model_hash
            FROM catalog_data.catalog_variant_slot slot
            LEFT JOIN catalog_data.catalog_variant_option option
              USING (catalog_version, asset_id, slot_id)
            WHERE slot.catalog_version = ? AND slot.asset_id = ?
            ORDER BY slot.slot_id, option.variant_id
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, version)
            statement.setString(2, asset.assetId)
            statement.executeQuery().use { rows ->
                val expected = asset.variantSlots.flatMap { slot -> slot.variants.map { slot to it } }
                for ((slot, variant) in expected) {
                    if (
                        !rows.next() ||
                        rows.getString("slot_id") != slot.slotId ||
                        rows.getString("slot_label") != slot.label ||
                        rows.getString("slot_kind") != slot.kind ||
                        rows.getString("variant_id") != variant.variantId ||
                        rows.getString("variant_label") != variant.label ||
                        rows.getString("model_hash").trim() != variant.resource.sha256
                    ) incomplete()
                }
                if (rows.next()) incomplete()
            }
        }
    }

    private fun verifyResources(envelope: CatalogEnvelope) {
        val descriptors = buildMap {
            for (asset in envelope.assets) {
                put(asset.resource.sha256, asset.resource)
                asset.thumbnail?.let { put(it.sha256, it) }
                for (slot in asset.variantSlots) for (variant in slot.variants) {
                    put(variant.resource.sha256, variant.resource)
                }
            }
        }
        for ((hash, descriptor) in descriptors) {
            val metadata = resourceMetadata(hash) ?: incomplete()
            if (
                metadata.resourceHash != hash ||
                metadata.mediaType != descriptor.mediaType ||
                metadata.byteLength != descriptor.byteLength
            ) incomplete()
            val bytes = resourceBytes(hash, 0, descriptor.byteLength - 1) ?: incomplete()
            if (bytes.size != descriptor.byteLength || CatalogHash.sha256(bytes) != hash) incomplete()
            try {
                CatalogMediaValidator.validate(descriptor.mediaType, bytes)
            } catch (_: CatalogContractViolation) {
                incomplete()
            }
        }
    }

    private fun incomplete(): Nothing = throw CatalogContractViolation("CATALOG_CURRENT_INCOMPLETE")
}

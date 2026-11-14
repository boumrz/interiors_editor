package dev.interiors.catalog

import java.sql.Connection
import java.time.OffsetDateTime
import javax.sql.DataSource

class CatalogPublisher(private val dataSource: DataSource) {
    fun publish(seed: PreparedCatalogSeed) {
        dataSource.connection.use { connection ->
            connection.autoCommit = false
            try {
                connection.createStatement().use { it.execute("SELECT pg_advisory_xact_lock(6214342)") }
                val existingHash = existingEnvelopeHash(connection, seed.envelope.catalogVersion)
                if (existingHash != null) {
                    if (existingHash != seed.envelopeHash) {
                        throw CatalogContractViolation("CATALOG_VERSION_CONFLICT")
                    }
                    connection.commit()
                    return
                }
                insertResources(connection, seed.resources)
                insertPublication(connection, seed)
                insertAssets(connection, seed.envelope)
                selectCurrent(connection, seed.envelope.catalogVersion)
                connection.commit()
            } catch (failure: Exception) {
                connection.rollback()
                throw failure
            }
        }
    }

    private fun existingEnvelopeHash(connection: Connection, version: String): String? = connection.prepareStatement(
        "SELECT envelope_hash FROM catalog_data.catalog_publication WHERE catalog_version = ?",
    ).use { statement ->
        statement.setString(1, version)
        statement.executeQuery().use { result -> if (result.next()) result.getString(1).trim() else null }
    }

    private fun insertResources(connection: Connection, resources: List<PreparedCatalogResource>) {
        connection.prepareStatement(
            """
            INSERT INTO catalog_data.catalog_resource(resource_hash, byte_length, media_type, resource_bytes)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (resource_hash) DO NOTHING
            """.trimIndent(),
        ).use { statement ->
            for (resource in resources) {
                statement.setString(1, resource.descriptor.sha256)
                statement.setInt(2, resource.descriptor.byteLength)
                statement.setString(3, resource.descriptor.mediaType)
                statement.setBytes(4, resource.bytes)
                statement.executeUpdate()
            }
        }
    }

    private fun insertPublication(connection: Connection, seed: PreparedCatalogSeed) {
        connection.prepareStatement(
            """
            INSERT INTO catalog_data.catalog_publication(
                catalog_version, published_at, envelope_hash, envelope_bytes, asset_count
            ) VALUES (?, ?, ?, ?, ?)
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, seed.envelope.catalogVersion)
            statement.setObject(2, OffsetDateTime.parse(seed.envelope.publishedAt))
            statement.setString(3, seed.envelopeHash)
            statement.setBytes(4, seed.envelopeBytes)
            statement.setInt(5, seed.envelope.assets.size)
            statement.executeUpdate()
        }
    }

    private fun insertAssets(connection: Connection, envelope: CatalogEnvelope) {
        connection.prepareStatement(
            """
            INSERT INTO catalog_data.catalog_asset(
                catalog_version, asset_id, label, section, category, anchor_class, front_direction,
                width_mm, depth_mm, height_mm, footprint_width_mm, footprint_depth_mm,
                model_hash, thumbnail_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
        ).use { statement ->
            for (asset in envelope.assets) {
                statement.setString(1, envelope.catalogVersion)
                statement.setString(2, asset.assetId)
                statement.setString(3, asset.label)
                statement.setString(4, asset.section)
                statement.setString(5, asset.category)
                statement.setString(6, asset.anchorClass)
                statement.setString(7, asset.frontDirection)
                statement.setInt(8, asset.dimensionsMm.width)
                statement.setInt(9, asset.dimensionsMm.depth)
                statement.setInt(10, asset.dimensionsMm.height)
                statement.setInt(11, asset.footprintMm.width)
                statement.setInt(12, asset.footprintMm.depth)
                statement.setString(13, asset.resource.sha256)
                statement.setString(14, asset.thumbnail?.sha256)
                statement.executeUpdate()
                insertVariants(connection, envelope.catalogVersion, asset)
            }
        }
    }

    private fun insertVariants(connection: Connection, version: String, asset: CatalogAsset) {
        for (slot in asset.variantSlots) {
            connection.prepareStatement(
                """
                INSERT INTO catalog_data.catalog_variant_slot(
                    catalog_version, asset_id, slot_id, label, slot_kind
                ) VALUES (?, ?, ?, ?, ?)
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, version)
                statement.setString(2, asset.assetId)
                statement.setString(3, slot.slotId)
                statement.setString(4, slot.label)
                statement.setString(5, slot.kind)
                statement.executeUpdate()
            }
            connection.prepareStatement(
                """
                INSERT INTO catalog_data.catalog_variant_option(
                    catalog_version, asset_id, slot_id, variant_id, label, model_hash
                ) VALUES (?, ?, ?, ?, ?, ?)
                """.trimIndent(),
            ).use { statement ->
                for (variant in slot.variants) {
                    statement.setString(1, version)
                    statement.setString(2, asset.assetId)
                    statement.setString(3, slot.slotId)
                    statement.setString(4, variant.variantId)
                    statement.setString(5, variant.label)
                    statement.setString(6, variant.resource.sha256)
                    statement.executeUpdate()
                }
            }
        }
    }

    private fun selectCurrent(connection: Connection, version: String) {
        connection.prepareStatement(
            """
            INSERT INTO catalog_data.catalog_current(singleton, catalog_version)
            VALUES (true, ?)
            ON CONFLICT (singleton) DO UPDATE SET catalog_version = EXCLUDED.catalog_version
            WHERE
                (SELECT published_at FROM catalog_data.catalog_publication WHERE catalog_version = EXCLUDED.catalog_version) >
                (SELECT p.published_at FROM catalog_data.catalog_publication p
                 JOIN catalog_data.catalog_current c USING (catalog_version) WHERE c.singleton = true)
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, version)
            statement.executeUpdate()
        }
    }
}

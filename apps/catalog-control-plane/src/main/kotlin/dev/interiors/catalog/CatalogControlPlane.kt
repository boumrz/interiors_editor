package dev.interiors.catalog

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import org.flywaydb.core.Flyway
import java.nio.file.Path
import javax.sql.DataSource

fun main(arguments: Array<String>) {
    require(arguments.size == 1) { "Expected exactly one command: migrate, validate, publish or serve" }
    when (arguments.single()) {
        "migrate" -> flyway().migrate()
        "validate" -> flyway().validate()
        "publish" -> publishCatalog()
        "serve" -> serveCatalog()
        else -> error("Unknown catalog command")
    }
}

private fun flyway(): Flyway = Flyway.configure()
    .dataSource(
        requiredEnvironment("CATALOG_MIGRATION_DATABASE_URL"),
        requiredEnvironment("CATALOG_MIGRATION_DATABASE_USER"),
        requiredEnvironment("CATALOG_MIGRATION_DATABASE_PASSWORD"),
    )
    .defaultSchema("catalog_migration")
    .schemas("catalog_migration")
    .createSchemas(false)
    .locations("classpath:db/migration")
    .load()

private fun publishCatalog() {
    val assetRoot = Path.of(requiredEnvironment("CATALOG_ASSET_ROOT"))
    val seed = CatalogSeedPreparer.prepare(
        envelopeSource = resource("/catalog/catalog-envelope-source.json"),
        resourceMapSource = resource("/catalog/catalog-resource-files-v1.json"),
        assetRoot = assetRoot,
    )
    dataSource("CATALOG_PUBLISH", readOnly = false).use { dataSource ->
        CatalogPublisher(dataSource).publish(seed)
    }
}

private fun serveCatalog() {
    val elevatedVariables = listOf("CATALOG_MIGRATION", "CATALOG_PUBLISH").flatMap { prefix ->
        listOf("URL", "USER", "PASSWORD").map { suffix -> "${prefix}_DATABASE_$suffix" }
    }
    check(elevatedVariables.none { System.getenv(it) != null }) {
        "Runtime must not receive migration or publisher credentials"
    }
    val dataSource = dataSource("CATALOG", readOnly = true)
    val repository = JdbcCatalogRepository(dataSource)
    repository.verifyRuntimeBoundary()
    repository.requireReadyCurrentPublication()
    Runtime.getRuntime().addShutdownHook(Thread { dataSource.close() })
    val host = System.getenv("CATALOG_HOST") ?: "127.0.0.1"
    check(host == "127.0.0.1") { "Internal Alpha Catalog Control Plane must bind loopback" }
    val port = (System.getenv("CATALOG_PORT") ?: "4174").toInt()
    embeddedServer(Netty, host = host, port = port) {
        catalogRoutes(repository)
    }.start(wait = true)
}

private fun dataSource(prefix: String, readOnly: Boolean): HikariDataSource {
    val config = HikariConfig().apply {
        jdbcUrl = requiredEnvironment("${prefix}_DATABASE_URL")
        username = requiredEnvironment("${prefix}_DATABASE_USER")
        password = requiredEnvironment("${prefix}_DATABASE_PASSWORD")
        maximumPoolSize = 4
        minimumIdle = 1
        isReadOnly = readOnly
        transactionIsolation = "TRANSACTION_READ_COMMITTED"
        poolName = "catalog-${prefix.lowercase()}"
    }
    return HikariDataSource(config)
}

private fun requiredEnvironment(name: String): String =
    System.getenv(name)?.takeIf(String::isNotBlank) ?: error("Missing environment: $name")

private fun resource(name: String): ByteArray =
    object {}.javaClass.getResourceAsStream(name)?.use { it.readAllBytes() }
        ?: error("Missing classpath resource: $name")

plugins {
    kotlin("jvm") version "2.4.10"
    application
    id("info.solidsoft.pitest") version "1.19.0"
}

group = "dev.interiors"
version = "0.1.0-alpha"

repositories {
    mavenCentral()
}

val ktorVersion = "3.5.2"

dependencies {
    implementation(platform("io.ktor:ktor-bom:$ktorVersion"))
    implementation("io.ktor:ktor-server-core-jvm")
    implementation("io.ktor:ktor-server-netty-jvm")
    implementation("io.ktor:ktor-server-content-negotiation-jvm")
    implementation("io.ktor:ktor-serialization-jackson-jvm")
    implementation("com.zaxxer:HikariCP:7.0.2")
    implementation("org.postgresql:postgresql:42.7.13")
    implementation("org.flywaydb:flyway-core:13.3.0")
    implementation("org.flywaydb:flyway-database-postgresql:13.3.0")

    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-test-host-jvm")
    testImplementation("org.testcontainers:testcontainers-postgresql:2.0.5")
}

kotlin {
    jvmToolchain(17)
}

application {
    mainClass.set("dev.interiors.catalog.CatalogControlPlaneKt")
}

tasks.test {
    useJUnitPlatform()
    val colimaSocket = file("${System.getProperty("user.home")}/.colima/default/docker.sock")
    if (colimaSocket.exists()) {
        environment("DOCKER_HOST", "unix://${colimaSocket.absolutePath}")
        environment("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE", "/var/run/docker.sock")
    }
}

tasks.processResources {
    from("../../contracts/catalog-control-plane/catalog-schema-v1.sql") {
        into("db/migration")
        rename { "V1__catalog_schema.sql" }
    }
}

fun registerCatalogCommand(taskName: String, command: String) =
    tasks.register<JavaExec>(taskName) {
        group = "catalog"
        classpath = sourceSets.main.get().runtimeClasspath
        mainClass.set(application.mainClass)
        args(command)
        val rejectedCredentialPrefixes = when (command) {
            "migrate", "validate" -> listOf("CATALOG_PUBLISH", "CATALOG")
            "publish" -> listOf("CATALOG_MIGRATION", "CATALOG")
            "serve" -> listOf("CATALOG_MIGRATION", "CATALOG_PUBLISH")
            else -> error("Unknown catalog command")
        }
        for (prefix in rejectedCredentialPrefixes) {
            for (suffix in listOf("URL", "USER", "PASSWORD")) {
                environment.remove("${prefix}_DATABASE_$suffix")
            }
        }
    }

registerCatalogCommand("catalogMigrate", "migrate")
val catalogValidate = registerCatalogCommand("catalogValidate", "validate")
registerCatalogCommand("catalogPublish", "publish")
registerCatalogCommand("catalogRun", "serve").configure {
    dependsOn(catalogValidate)
}

dependencyLocking {
    lockAllConfigurations()
}

pitest {
    pitestVersion.set("1.25.8")
    junit5PluginVersion.set("1.2.3")
    targetClasses.set(
        setOf(
            "dev.interiors.catalog.CatalogEnvelopeDecoder*",
            "dev.interiors.catalog.CatalogJsonCanonicalizer*",
            "dev.interiors.catalog.CatalogSeedPreparer*",
            "dev.interiors.catalog.CatalogHash*",
            "dev.interiors.catalog.CatalogMediaValidator*",
            "dev.interiors.catalog.CatalogPublisher*",
            "dev.interiors.catalog.JdbcCatalogRepository*",
            "dev.interiors.catalog.CatalogHttpKt*",
        ),
    )
    targetTests.set(
        setOf(
            "dev.interiors.catalog.CatalogEnvelopeDecoderTest",
            "dev.interiors.catalog.CatalogSeedPreparerTest",
            "dev.interiors.catalog.CatalogRoutesTest",
            "dev.interiors.catalog.JdbcCatalogRepositoryIntegrationTest",
        ),
    )
    excludedClasses.set(setOf("dev.interiors.catalog.CatalogControlPlaneKt"))
    outputFormats.set(setOf("XML", "HTML"))
    timestampedReports.set(false)
}

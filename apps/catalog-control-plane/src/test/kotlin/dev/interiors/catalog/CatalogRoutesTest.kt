package dev.interiors.catalog

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.head
import io.ktor.client.request.options
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

class CatalogRoutesTest {
    private val mapper = ObjectMapper()
    private val envelopeBytes = Files.readAllBytes(
        Path.of("../../contracts/catalog-control-plane/fixtures/catalog-envelope-v1.valid.json"),
    )
    private val envelopeHash = sha256(envelopeBytes)
    private val publication = StoredCatalogPublication(
        catalogVersion = "alpha-2026-08-26.1",
        envelopeHash = envelopeHash,
        envelopeBytes = envelopeBytes,
    )
    private val resourceBytes = Base64.getDecoder().decode(
        "Z2xURgIAAAAwAAAAHAAAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAifX0g",
    )
    private val resourceHash = sha256(resourceBytes)
    private val resource = StoredCatalogResource(resourceHash, "model/gltf-binary", resourceBytes)

    @Test
    fun `serves current exact envelope bytes with strong etag and revalidation`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }

        val response = client.get("/catalog-api/v1/catalogs/current") {
            header(HttpHeaders.Accept, "application/json")
        }

        assertEquals(HttpStatusCode.OK, response.status)
        assertContentEquals(envelopeBytes, response.bodyAsBytes())
        assertEquals("\"$envelopeHash\"", response.headers[HttpHeaders.ETag])
        assertEquals("no-cache, max-age=0, must-revalidate", response.headers[HttpHeaders.CacheControl])
        assertEquals(envelopeBytes.size.toString(), response.headers[HttpHeaders.ContentLength])
    }

    @Test
    fun `serves version-addressed envelope as immutable and honours exact etag`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }

        val version = client.get("/catalog-api/v1/catalogs/alpha-2026-08-26.1") {
            header(HttpHeaders.Accept, "application/json")
        }
        val unchanged = client.get("/catalog-api/v1/catalogs/current") {
            header(HttpHeaders.Accept, "application/json")
            header(HttpHeaders.IfNoneMatch, "\"$envelopeHash\"")
        }

        assertEquals(HttpStatusCode.OK, version.status)
        assertEquals("public, max-age=31536000, immutable", version.headers[HttpHeaders.CacheControl])
        assertEquals(HttpStatusCode.NotModified, unchanged.status)
        assertEquals(0, unchanged.bodyAsBytes().size)
    }

    @Test
    fun `serves immutable resources through full head conditional and range responses`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }

        val full = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
        }
        val head = client.head("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
        }
        val unchanged = client.head("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
            header(HttpHeaders.IfNoneMatch, "\"$resourceHash\"")
        }
        val range = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
            header(HttpHeaders.Range, "bytes=0-19")
        }

        assertEquals(HttpStatusCode.OK, full.status)
        assertContentEquals(resourceBytes, full.bodyAsBytes())
        assertEquals("bytes", full.headers[HttpHeaders.AcceptRanges])
        assertEquals(HttpStatusCode.OK, head.status)
        assertEquals(resourceBytes.size.toString(), head.headers[HttpHeaders.ContentLength])
        assertEquals(0, head.bodyAsBytes().size)
        assertEquals(HttpStatusCode.NotModified, unchanged.status)
        assertEquals("\"$resourceHash\"", unchanged.headers[HttpHeaders.ETag])
        assertEquals("public, max-age=31536000, immutable", unchanged.headers[HttpHeaders.CacheControl])
        assertEquals(0, unchanged.bodyAsBytes().size)
        assertEquals(HttpStatusCode.PartialContent, range.status)
        assertEquals("bytes 0-19/${resourceBytes.size}", range.headers[HttpHeaders.ContentRange])
        assertEquals("\"$resourceHash\"", range.headers[HttpHeaders.ETag])
        assertEquals("public, max-age=31536000, immutable", range.headers[HttpHeaders.CacheControl])
        assertEquals("bytes", range.headers[HttpHeaders.AcceptRanges])
        assertContentEquals(resourceBytes.copyOfRange(0, 20), range.bodyAsBytes())
    }

    @Test
    fun `clamps satisfiable closed ranges to the final resource byte`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }
        val cases = listOf(
            Triple("bytes=0-1048575", 0, resourceBytes.lastIndex),
            Triple("bytes=0-2147483647", 0, resourceBytes.lastIndex),
            Triple("bytes=3-1048575", 3, resourceBytes.lastIndex),
            Triple("bytes=0-${resourceBytes.lastIndex}", 0, resourceBytes.lastIndex),
            Triple("bytes=${resourceBytes.lastIndex}-${resourceBytes.lastIndex}", resourceBytes.lastIndex, resourceBytes.lastIndex),
        )

        for ((range, start, end) in cases) {
            val response = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
                header(HttpHeaders.Accept, "model/gltf-binary")
                header(HttpHeaders.Range, range)
            }
            assertEquals(HttpStatusCode.PartialContent, response.status, range)
            assertEquals("bytes $start-$end/${resourceBytes.size}", response.headers[HttpHeaders.ContentRange], range)
            assertEquals((end - start + 1).toString(), response.headers[HttpHeaders.ContentLength], range)
            assertContentEquals(resourceBytes.copyOfRange(start, end + 1), response.bodyAsBytes(), range)
        }
    }

    @Test
    fun `rejects unsatisfiable and malformed ranges without returning resource bytes`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }
        val ranges = listOf(
            "bytes=${resourceBytes.size}-${resourceBytes.size + 10}",
            "bytes=20-19",
            "bytes=0-",
            "bytes=-20",
            "bytes=00-19",
            "bytes=0-1,3-4",
            "bytes=0-9007199254740992",
            "nibbles=0-2",
        )

        for (range in ranges) {
            val response = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
                header(HttpHeaders.Accept, "model/gltf-binary")
                header(HttpHeaders.Range, range)
            }
            assertEquals(HttpStatusCode.RequestedRangeNotSatisfiable, response.status, range)
            assertEquals("bytes */${resourceBytes.size}", response.headers[HttpHeaders.ContentRange], range)
            assertEquals(0, response.bodyAsBytes().size, range)
        }
    }

    @Test
    fun `rejects prohibited headers methods queries accept values and range forms without a body`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }

        val cookie = client.get("/catalog-api/v1/catalogs/current") {
            header(HttpHeaders.Accept, "application/json")
            header(HttpHeaders.Cookie, "project=forbidden")
        }
        val query = client.get("/catalog-api/v1/catalogs/current?project=forbidden") {
            header(HttpHeaders.Accept, "application/json")
        }
        val options = client.options("/catalog-api/v1/catalogs/current")
        val mismatch = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "image/png")
        }
        val badRange = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
            header(HttpHeaders.Range, "bytes=0-")
        }

        assertEquals(HttpStatusCode.BadRequest, cookie.status)
        assertEquals(HttpStatusCode.BadRequest, query.status)
        assertEquals(HttpStatusCode.MethodNotAllowed, options.status)
        assertEquals("GET", options.headers[HttpHeaders.Allow])
        assertEquals(HttpStatusCode.NotAcceptable, mismatch.status)
        assertEquals(HttpStatusCode.RequestedRangeNotSatisfiable, badRange.status)
        assertEquals("bytes */${resourceBytes.size}", badRange.headers[HttpHeaders.ContentRange])
        for (response in listOf(cookie, query, options, mismatch, badRange)) {
            assertEquals(0, response.bodyAsBytes().size)
            assertEquals("no-store", response.headers[HttpHeaders.CacheControl])
        }
    }

    @Test
    fun `rejects every unsupported method with the exact route allowlist and no-store`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }
        val cases = listOf(
            Triple("/catalog-api/v1/catalogs/current", HttpMethod.Post, "GET"),
            Triple("/catalog-api/v1/catalogs/alpha-2026-08-26.1", HttpMethod.Put, "GET"),
            Triple("/catalog-api/v1/catalogs/current", HttpMethod.Head, "GET"),
            Triple("/catalog-api/v1/resources/sha256/$resourceHash", HttpMethod.Post, "GET, HEAD"),
            Triple("/catalog-api/v1/resources/sha256/$resourceHash", HttpMethod.Delete, "GET, HEAD"),
        )

        for ((path, method, allow) in cases) {
            val response = client.request(path) { this.method = method }

            assertEquals(HttpStatusCode.MethodNotAllowed, response.status, "$method $path")
            assertEquals(allow, response.headers[HttpHeaders.Allow], "$method $path")
            assertEquals("no-store", response.headers[HttpHeaders.CacheControl], "$method $path")
            assertEquals(0, response.bodyAsBytes().size, "$method $path")
        }
    }

    @Test
    fun `rejects prohibited metadata shapes before repository access`() = testApplication {
        val reads = AtomicInteger()
        application { catalogRoutes(ExplodingCatalogRepository(reads)) }
        val cases = listOf<suspend () -> io.ktor.client.statement.HttpResponse>(
            {
                client.get("/catalog-api/v1/catalogs/current?project=forbidden") {
                    header(HttpHeaders.Accept, "application/json")
                }
            },
            {
                client.get("/catalog-api/v1/catalogs/current") {
                    header(HttpHeaders.Accept, "application/json")
                    header(HttpHeaders.Cookie, "revision=forbidden")
                }
            },
            {
                client.get("/catalog-api/v1/catalogs/alpha-2026-08-26.1") {
                    header(HttpHeaders.Accept, "application/json")
                    header(HttpHeaders.Authorization, "Bearer history-forbidden")
                }
            },
            {
                client.request("/catalog-api/v1/catalogs/current") {
                    method = HttpMethod.Get
                    header(HttpHeaders.Accept, "application/json")
                    setBody("{\"portableBackup\":\"forbidden\"}")
                }
            },
        )

        for (request in cases) {
            val response = request()
            assertEquals(HttpStatusCode.BadRequest, response.status)
            assertEquals("no-store", response.headers[HttpHeaders.CacheControl])
            assertEquals(0, response.bodyAsBytes().size)
        }
        assertEquals(0, reads.get())
    }

    @Test
    fun `rejects ambiguous repeated conditional and range headers`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }

        val conditional = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
            headers.append(HttpHeaders.IfNoneMatch, "\"$resourceHash\"")
            headers.append(HttpHeaders.IfNoneMatch, "\"${"0".repeat(64)}\"")
        }
        val range = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
            headers.append(HttpHeaders.Range, "bytes=0-1")
            headers.append(HttpHeaders.Range, "bytes=2-3")
        }

        assertEquals(HttpStatusCode.BadRequest, conditional.status)
        assertEquals(HttpStatusCode.RequestedRangeNotSatisfiable, range.status)
    }

    @Test
    fun `loads resource bytes only for the requested successful GET body`() = testApplication {
        val byteReads = AtomicInteger()
        application { catalogRoutes(CountingResourceRepository(publication, resource, byteReads)) }

        client.head("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
        }
        client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
            header(HttpHeaders.IfNoneMatch, "\"$resourceHash\"")
        }
        client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "image/png")
        }
        val range = client.get("/catalog-api/v1/resources/sha256/$resourceHash") {
            header(HttpHeaders.Accept, "model/gltf-binary")
            header(HttpHeaders.Range, "bytes=0-19")
        }

        assertEquals(HttpStatusCode.PartialContent, range.status)
        assertContentEquals(resourceBytes.copyOfRange(0, 20), range.bodyAsBytes())
        assertEquals(1, byteReads.get())
    }

    @Test
    fun `executes every shared HTTP fixture`() = testApplication {
        application { catalogRoutes(FakeCatalogRepository(publication, resource)) }
        val cases = mapper.readTree(
            Files.readAllBytes(Path.of("../../contracts/catalog-control-plane/fixtures/http-cases.json")),
        ).required("cases")

        for (case in cases) {
            val path = when (case.required("route").textValue()) {
                "current" -> "/catalog-api/v1/catalogs/current"
                "version" -> "/catalog-api/v1/catalogs/alpha-2026-08-26.1"
                "resource" -> "/catalog-api/v1/resources/sha256/$resourceHash"
                else -> error("Unknown HTTP fixture route")
            }
            val query = case.optionalText("query")?.let { "?$it" }.orEmpty()
            val response = client.request(path + query) {
                method = HttpMethod.parse(case.required("method").textValue())
                case.optionalText("accept")?.let { header(HttpHeaders.Accept, it) }
                case.optionalText("cookie")?.let { header(HttpHeaders.Cookie, it) }
                case.optionalText("authorization")?.let { header(HttpHeaders.Authorization, it) }
                case.optionalText("range")?.let { header(HttpHeaders.Range, it) }
                case.optionalText("body")?.let { setBody(it) }
                case.optionalText("ifNoneMatch")?.let {
                    header(HttpHeaders.IfNoneMatch, if (it == "matching") "\"$resourceHash\"" else it)
                }
            }

            assertEquals(HttpStatusCode.fromValue(case.required("status").intValue()), response.status, case.required("id").textValue())
            case.optionalText("allow")?.let { assertEquals(it, response.headers[HttpHeaders.Allow]) }
        }
    }

    private class FakeCatalogRepository(
        private val publication: StoredCatalogPublication,
        private val storedResource: StoredCatalogResource,
    ) : CatalogReadRepository {
        override fun currentPublication(): StoredCatalogPublication = publication
        override fun publication(version: String): StoredCatalogPublication? =
            publication.takeIf { it.catalogVersion == version }
        override fun resourceMetadata(hash: String): StoredCatalogResourceMetadata? = storedResource
            .takeIf { it.resourceHash == hash }
            ?.let { StoredCatalogResourceMetadata(it.resourceHash, it.mediaType, it.resourceBytes.size) }
        override fun resourceBytes(hash: String, startInclusive: Int, endInclusive: Int): ByteArray? = storedResource
            .takeIf { it.resourceHash == hash }
            ?.resourceBytes
            ?.copyOfRange(startInclusive, endInclusive + 1)
    }

    private class ExplodingCatalogRepository(private val reads: AtomicInteger) : CatalogReadRepository {
        override fun currentPublication(): StoredCatalogPublication? = unexpectedRead()
        override fun publication(version: String): StoredCatalogPublication? = unexpectedRead()
        override fun resourceMetadata(hash: String): StoredCatalogResourceMetadata? = unexpectedRead()
        override fun resourceBytes(hash: String, startInclusive: Int, endInclusive: Int): ByteArray? = unexpectedRead()

        private fun <T> unexpectedRead(): T {
            reads.incrementAndGet()
            error("Repository must not be read for a prohibited request")
        }
    }

    private class CountingResourceRepository(
        private val publication: StoredCatalogPublication,
        private val storedResource: StoredCatalogResource,
        private val byteReads: AtomicInteger,
    ) : CatalogReadRepository {
        override fun currentPublication(): StoredCatalogPublication = publication
        override fun publication(version: String): StoredCatalogPublication? = publication.takeIf { it.catalogVersion == version }
        override fun resourceMetadata(hash: String): StoredCatalogResourceMetadata? = storedResource
            .takeIf { it.resourceHash == hash }
            ?.let { StoredCatalogResourceMetadata(it.resourceHash, it.mediaType, it.resourceBytes.size) }
        override fun resourceBytes(hash: String, startInclusive: Int, endInclusive: Int): ByteArray? {
            byteReads.incrementAndGet()
            return storedResource.takeIf { it.resourceHash == hash }
                ?.resourceBytes
                ?.copyOfRange(startInclusive, endInclusive + 1)
        }
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    private fun JsonNode.required(field: String): JsonNode = get(field) ?: error("Missing fixture field: $field")
    private fun JsonNode.optionalText(field: String): String? = get(field)?.textValue()
}

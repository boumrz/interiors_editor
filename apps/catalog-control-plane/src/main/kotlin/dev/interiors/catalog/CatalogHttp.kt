package dev.interiors.catalog

import io.ktor.http.CacheControl
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.withCharset
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.request.httpMethod
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytes
import io.ktor.server.routing.head
import io.ktor.server.routing.route
import io.ktor.server.routing.routing

data class StoredCatalogPublication(
    val catalogVersion: String,
    val envelopeHash: String,
    val envelopeBytes: ByteArray,
)

data class StoredCatalogResource(
    val resourceHash: String,
    val mediaType: String,
    val resourceBytes: ByteArray,
)

data class StoredCatalogResourceMetadata(
    val resourceHash: String,
    val mediaType: String,
    val byteLength: Int,
)

interface CatalogReadRepository {
    fun currentPublication(): StoredCatalogPublication?
    fun publication(version: String): StoredCatalogPublication?
    fun resourceMetadata(hash: String): StoredCatalogResourceMetadata?
    fun resourceBytes(hash: String, startInclusive: Int, endInclusive: Int): ByteArray?
}

fun Application.catalogRoutes(repository: CatalogReadRepository) {
    routing {
        route("/catalog-api/v1/catalogs") {
            route("/current") {
                handle {
                    if (call.request.httpMethod == HttpMethod.Get) {
                        servePublication(call, "no-cache, max-age=0, must-revalidate", repository::currentPublication)
                    } else {
                        methodNotAllowed(call, "GET")
                    }
                }
            }
            route("/{version}") {
                handle {
                    if (call.request.httpMethod != HttpMethod.Get) {
                        methodNotAllowed(call, "GET")
                    } else {
                        val version = call.parameters["version"].orEmpty()
                        if (!catalogVersionPattern.matches(version) || version == "current") {
                            empty(call, HttpStatusCode.BadRequest)
                        } else {
                            servePublication(
                                call,
                                "public, max-age=31536000, immutable",
                            ) { repository.publication(version) }
                        }
                    }
                }
            }
        }
        route("/catalog-api/v1/resources/sha256/{hash}") {
            handle {
                when (call.request.httpMethod) {
                    HttpMethod.Get -> serveResource(call, repository, headOnly = false)
                    HttpMethod.Head -> serveResource(call, repository, headOnly = true)
                    else -> methodNotAllowed(call, "GET, HEAD")
                }
            }
        }
    }
}

private suspend fun serveResource(call: ApplicationCall, repository: CatalogReadRepository, headOnly: Boolean) {
    if (prohibitedRequest(call)) return
    val hash = call.parameters["hash"].orEmpty()
    if (!sha256Pattern.matches(hash)) {
        empty(call, HttpStatusCode.BadRequest)
        return
    }
    val resource = repository.resourceMetadata(hash)
    if (resource == null) {
        empty(call, HttpStatusCode.NotFound)
        return
    }
    if (!hasExactHeader(call, HttpHeaders.Accept, resource.mediaType)) {
        empty(call, HttpStatusCode.NotAcceptable)
        return
    }
    val ifNoneMatchValues = call.request.headers.getAll(HttpHeaders.IfNoneMatch)
    if (ifNoneMatchValues != null && ifNoneMatchValues.size != 1) {
        empty(call, HttpStatusCode.BadRequest)
        return
    }
    val ifNoneMatch = ifNoneMatchValues?.single()
    val etag = "\"${resource.resourceHash}\""
    if (ifNoneMatch != null && ifNoneMatch != etag && !quotedSha256Pattern.matches(ifNoneMatch)) {
        empty(call, HttpStatusCode.BadRequest)
        return
    }
    val rangeValues = call.request.headers.getAll(HttpHeaders.Range)
    if (call.request.headers.getAll(HttpHeaders.IfRange) != null || (headOnly && rangeValues != null)) {
        empty(call, HttpStatusCode.BadRequest)
        return
    }
    if (ifNoneMatch == etag) {
        call.response.header(HttpHeaders.ETag, etag)
        call.response.header(HttpHeaders.CacheControl, "public, max-age=31536000, immutable")
        call.respond(HttpStatusCode.NotModified)
        return
    }
    if (rangeValues != null) {
        val parsed = rangeValues.singleOrNull()?.let { parseRange(it, resource.byteLength) }
        if (parsed == null) {
            call.response.header(HttpHeaders.ContentRange, "bytes */${resource.byteLength}")
            empty(call, HttpStatusCode.RequestedRangeNotSatisfiable)
            return
        }
        val (start, end) = parsed
        val bytes = repository.resourceBytes(hash, start, end)
        if (bytes == null || bytes.size != end - start + 1) {
            empty(call, HttpStatusCode.NotFound)
            return
        }
        resourceHeaders(call, etag)
        call.response.header(HttpHeaders.ContentRange, "bytes $start-$end/${resource.byteLength}")
        call.respondBytes(bytes, ContentType.parse(resource.mediaType), HttpStatusCode.PartialContent)
        return
    }
    resourceHeaders(call, etag)
    if (headOnly) {
        call.respond(object : OutgoingContent.NoContent() {
            override val status = HttpStatusCode.OK
            override val contentLength: Long = resource.byteLength.toLong()
            override val contentType: ContentType = ContentType.parse(resource.mediaType)
        })
    } else {
        val bytes = repository.resourceBytes(hash, 0, resource.byteLength - 1)
        if (bytes == null || bytes.size != resource.byteLength) {
            empty(call, HttpStatusCode.NotFound)
            return
        }
        call.respondBytes(bytes, ContentType.parse(resource.mediaType), HttpStatusCode.OK)
    }
}

private fun resourceHeaders(call: ApplicationCall, etag: String) {
    call.response.header(HttpHeaders.ETag, etag)
    call.response.header(HttpHeaders.CacheControl, "public, max-age=31536000, immutable")
    call.response.header(HttpHeaders.AcceptRanges, "bytes")
}

private fun parseRange(header: String, length: Int): Pair<Int, Int>? {
    val match = closedRangePattern.matchEntire(header) ?: return null
    val start = match.groupValues[1].toLongOrNull() ?: return null
    val end = match.groupValues[2].toLongOrNull() ?: return null
    if (start > Int.MAX_VALUE || end > Int.MAX_VALUE || start > end || start >= length) return null
    return start.toInt() to minOf(end.toInt(), length - 1)
}

private suspend fun methodNotAllowed(call: ApplicationCall, allow: String) {
    call.response.header(HttpHeaders.Allow, allow)
    empty(call, HttpStatusCode.MethodNotAllowed)
}

private suspend fun prohibitedRequest(call: ApplicationCall): Boolean {
    val contentLengths = call.request.headers.getAll(HttpHeaders.ContentLength)
    if (
        call.request.queryParameters.names().isNotEmpty() ||
        call.request.headers.getAll(HttpHeaders.Cookie) != null ||
        call.request.headers.getAll(HttpHeaders.Authorization) != null ||
        (contentLengths != null && (contentLengths.size != 1 || contentLengths.single().toLongOrNull() != 0L)) ||
        call.request.headers.getAll(HttpHeaders.TransferEncoding) != null
    ) {
        empty(call, HttpStatusCode.BadRequest)
        return true
    }
    return false
}

private val catalogVersionPattern = Regex("^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$")
private val sha256Pattern = Regex("^[0-9a-f]{64}$")
private val quotedSha256Pattern = Regex("^\"[0-9a-f]{64}\"$")
private val closedRangePattern = Regex("^bytes=(0|[1-9][0-9]*)-(0|[1-9][0-9]*)$")

private suspend fun servePublication(
    call: ApplicationCall,
    cacheControl: String,
    loadPublication: () -> StoredCatalogPublication?,
) {
    if (prohibitedRequest(call)) return
    if (!hasExactHeader(call, HttpHeaders.Accept, "application/json")) {
        empty(call, HttpStatusCode.NotAcceptable)
        return
    }
    val ifNoneMatchValues = call.request.headers.getAll(HttpHeaders.IfNoneMatch)
    if (ifNoneMatchValues != null && (
            ifNoneMatchValues.size != 1 || !quotedSha256Pattern.matches(ifNoneMatchValues.single())
        )
    ) {
        empty(call, HttpStatusCode.BadRequest)
        return
    }
    val publication = loadPublication()
    if (publication == null) {
        empty(call, HttpStatusCode.NotFound)
        return
    }
    val etag = "\"${publication.envelopeHash}\""
    call.response.header(HttpHeaders.ETag, etag)
    call.response.header(HttpHeaders.CacheControl, cacheControl)
    if (ifNoneMatchValues?.singleOrNull() == etag) {
        call.respond(HttpStatusCode.NotModified)
        return
    }
    call.respondBytes(
        publication.envelopeBytes,
        ContentType.Application.Json.withCharset(Charsets.UTF_8),
        HttpStatusCode.OK,
    )
}

private fun hasExactHeader(call: ApplicationCall, name: String, expected: String): Boolean =
    call.request.headers.getAll(name) == listOf(expected)

private suspend fun empty(call: ApplicationCall, status: HttpStatusCode) {
    call.response.header(HttpHeaders.CacheControl, CacheControl.NoStore(null).toString())
    call.respond(object : OutgoingContent.NoContent() {
        override val status: HttpStatusCode = status
    })
}

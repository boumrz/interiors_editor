# Netherlands server migration — 2026-11-08

The owner authorized root@147.45.133.75 after creating the Netherlands server and adding the dedicated local Ed25519 public key. This directory records deployment of the existing approved release; no application source was modified.

- Current host: 147.45.133.75, Timeweb server9542199, Ubuntu26.04.1, hostname ams-1-vm-ftd8.
- Origins: https://domiknote.ru/ (Telegram) and https://www.domiknote.ru/ (preserved Web/PWA).
- Current release: e82158c9f176ee73--0ce06bee515635c1. All309 paths and74 backend package files verified.
- Catalog recreated from its pinned release with fresh server-side role credentials; exact live public SHA matched before and after migration. User projects and backups remain local and were not copied/uploaded.
- PostgreSQL remains Docker18.4 pinned by digest and bound127.0.0.1:55432; read-only Java catalog binds127.0.0.1:4174 under its separate system user. No credentials are stored in this evidence directory.
- TLS expires2027-02-06. Certbot reconfigure passed staging with HTTP01, /var/lib/letsencrypt webroot; timer active and deploy hook validates/reloads Nginx.
- All4 authoritative DNS servers report both A records147.45.133.75. Old recursive/OS caches can temporarily retain194.87.187.153, TTL600. Old host still serves the same approved release.
- Main Mini App bot/menu URL was preserved. Actual current Mac Telegram initial and repeat launch rendered Projects home while VPN stayed enabled. No project edits or messages were made. Android main workflow is owner manual; iOS deferred. No every-VPN guarantee or full-workflow acceptance is claimed.
- Two spent DNS01 TXT records remain; HTTP01 renewal no longer needs them. Existing unrelated DNS, services and old VPS were preserved. Do not delete old VPS: other subdomains still use it.

## Rollback

The old server was not modified. If rollback is needed, restore only A record79088527 (domiknote.ru) and79090079 (www.domiknote.ru) to194.87.187.153 / WORKSPACE, keeping other records intact. Both origins preserve the same browser storage identities and immutable release resources. The old VPS still has its own valid TLS and service stack.

## Evidence

Read summary.json, https-preflight.json, catalog-contract-checks.json, actual-mac-telegram-startup.json, authoritative-dns-final.json, certbot-webroot-reconfigure.log and final-server-checks.log. The initial HEAD probe used an incorrect manifest-only405 expectation on a resource route; its raw failed probe is retained separately, and the resource HEAD200/length/hash/range contract was independently checked after reading CatalogHttp.kt. No product code change was required.

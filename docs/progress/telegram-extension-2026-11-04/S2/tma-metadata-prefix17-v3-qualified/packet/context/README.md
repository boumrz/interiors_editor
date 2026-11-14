# Web production root

This is the single `apps/web` production composition root for InteriorsEditor.
Its seed source is exactly `create-rspack@2.1.8` with the `react-ts` template,
adapted under Story 1.1 on Node `24.19.0` LTS and pnpm `11.20.0`.

The source boundary is `adapters → application → domain`; platform composition
is in `src/app`. The existing Web/PWA includes local projects and exact resource
storage, portable backups, a catalog gateway and a service worker. There is no
remote Project API or cloud synchronization. The catalog backend owns only
catalog metadata/resources.

S1 extracted `src/app/browser-editor-app.tsx` from the shared editor under its
applicable READY. Initial S2 signed-launch/session components and isolated
scope metadata store are tested but not wired to a product entry or Project
writes; no Telegram build or launch command is
available yet. See [current evidence](../../docs/progress/telegram-extension-2026-11-04/README.md).
Web/PWA remains supported through S0–S7.
Preparation for later Telegram-only retirement does not authorize removing
this workspace: the shared editor, domain, codecs, persistence and renderer
remain here. See the [extension specification](../../plans/telegram-mini-app-extension-spec-2026-11-04.md)
and [S0 progress](../../plans/telegram-mini-app-s0-preflight-2026-11-04.md).

Run all current checks from the repository root with:

```bash
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm run verify
```

The active phone preview serves `apps/web/dist`. While it is running, use
isolated output/preview paths for build and browser gates as described in the
S1 evidence; ordinary build/verify can replace that live output.

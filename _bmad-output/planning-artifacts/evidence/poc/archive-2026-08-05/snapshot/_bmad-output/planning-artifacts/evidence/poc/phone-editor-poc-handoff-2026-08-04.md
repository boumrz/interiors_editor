---
title: "Phone editor POC handoff evidence"
status: pending-owner-review
waiver: W-POC-2026-08-04
architecture_decision: AD-18
generated_at: 2026-08-04T23:42:15+03:00
owner_disposition: pending-review
closed_at: null
---

# Phone editor POC — handoff evidence

This record is an evidence snapshot for the bounded root phone POC authorized
by `W-POC-2026-08-04`. It is **not** a POC closure, production acceptance,
`G-READY` result, release authorization, physical-device certification, or
permission to promote this code into product delivery. Any code/configuration
change below invalidates this snapshot until its hashes and checks are renewed.

## Scope demonstrated

- Source-controlled synthetic plan state starts with eight wall segments.
- The matching `Перегородка` tool permits exactly one in-memory divider
  addition; the action becomes disabled afterwards and direct repeated reducer
  dispatches are idempotent. A mismatched tool explains the guard without
  changing the plan.
- InApp Focus keeps the edited session, shows an explicit exit and the current
  selected tool, preserves the truthful `POC · demo data · not saved` status,
  and fits the plan/action controls into the iPhone-13-Chrome emulated
  viewport.
- Reload resets tool, Focus and divider state. Runtime browser evidence found
  no non-loopback requests and empty local/session storage.

## Reproducible runtime

| Item | Value |
| --- | --- |
| Node | `v24.19.0` |
| pnpm | `11.20.0` |
| package bootstrap | `npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm install --frozen-lockfile` |
| developer launch | `npm run poc:dev` |
| complete local gate | `npm run poc:verify` |
| first-run operational dependency | npm registry/cache access for the version-pinned `npx` launcher |

The `poc:*` root scripts were independently exercised from an ordinary shell
whose default Node was `23.6.1`; the launcher ran the required Node/pnpm pair
and passed the runtime guard. No commit was made.

## Quality snapshot

The following completed successfully on 2026-08-04 under the exact runtime
above:

| Check | Result |
| --- | --- |
| frozen install | lockfile accepted; no resolution update |
| production dependency audit | 0 known vulnerabilities across 3 production dependencies |
| TypeScript | `tsc --noEmit` passed |
| Rstest | 5/5 passed |
| Rspack production build | passed in 67 ms |
| Playwright, `phone-chrome` / `devices['iPhone 13']` | 5/5 passed in 3.2 s |
| Stryker command runner over Rstest | 34/34 killed, 100.00% for `src/poc/editor-state.ts` |
| Fallow dead-code scan for `@interiors/web` | 0 issues |
| prohibited POC source API scan | 0 hits for storage, IndexedDB/OPFS, service worker, `fetch`, XHR, native fullscreen and `S-[1-6]` provenance |
| phone viewport geometry | normal and Focus document `scrollHeight` ≤ `innerHeight` at 390×664 CSS px; tested critical controls are fully visible and ≥44×44 CSS px |

The production build emitted `main.js` 197,690 bytes raw / 62,773 bytes gzip
and `main.css` 5,993 bytes raw / 2,040 bytes gzip. These are an early bundle
baseline, not a mobile performance certification.

## Screenshot provenance

Both viewport captures used a local `http://127.0.0.1:4173` Rspack server,
Chrome via Playwright, `devices['iPhone 13']` with its 390×664 CSS-px layout
viewport, `ru-RU` locale and light color scheme. The Focus capture first
selected `Перегородка`, added it, and then entered InApp Focus. They are
browser-emulation evidence only.

| Capture | SHA-256 |
| --- | --- |
| [`phone-poc-initial.png`](../../../../docs/poc/screenshots/phone-poc-initial.png) | `96c7480ca0342408b5ae4dd930488d8a932c8e79bc3bce63398b5b470e09969a` |
| [`phone-poc-focus.png`](../../../../docs/poc/screenshots/phone-poc-focus.png) | `689b7a6d57bac32b8c5d47a06a5196c8062ca3318f953fe4bab45d106418d828` |

## Path-hash manifest

This manifest covers every non-generated POC delivery path that can alter the
runtime, tests, POC claims or screenshots. The only deliberate omission is
this self-referential handoff record. Generated/ignored outputs are excluded:
dependency directories, `dist`, test reports, mutation backups and
`/.playwright-cli/**`; the latter is transient interactive-browser residue,
not POC evidence, and is ignored by `.gitignore`.

| Path | SHA-256 |
| --- | --- |
| `.gitignore` | `d3a60e6ae8a8fe820e2b25842dc13689af338ba11e7bdebf5d550ab528c5e55e` |
| `.nvmrc` | `7e8a2fa94951112b894a3dbe3d05efef5e9263741fa49125f0a70f40fedab4cc` |
| `.npmrc` | `260b49519991597521e955d1b18ea0d7b423167daf79b32d47b18855de14e7d3` |
| `package.json` | `3cafd3aaa6b41e3266e84f84419ec131ec12c76e819925fe074cfba30b8037b0` |
| `pnpm-workspace.yaml` | `d2e75aa6b27ba385e62bcdf97da938b30263e96d85c958a17eef1efa3aec8b80` |
| `pnpm-lock.yaml` | `544d0a168a5568e1d0c3243d202fa1adb0fa4cc26e724ad67d9587c849d9069b` |
| `README.md` | `2f4b86af4ef0bc70785e1c820de8c2632a8632a35efafb47d2a40647fe1243e2` |
| `docs/index.md` | `51b7867ff9274e7917c97da5f3d74020b0dd577c05c8a013949493cc795d467d` |
| `apps/web/package.json` | `8a8755101e271c5e480b7b6b17bb1f1b513f32d8298771705a0944811be24c4a` |
| `apps/web/tsconfig.json` | `9f4368c4d18d145dd1473906391dca3ddf62893775a0aa44d1b2d1b610b2888e` |
| `apps/web/rspack.config.mjs` | `7e603b16dff492ca5c119a627fea7906229038374eea794590aeb11a574fe9d7` |
| `apps/web/rstest.config.mjs` | `5ab2c32f8998c3184b03db6bae8da5350760abe3ed781a5b676f72fa1c363d15` |
| `apps/web/playwright.config.mjs` | `65e0f9541d60c69cabcc25f99c66c9b817733c62c4261af00e58a692ee3692ea` |
| `apps/web/stryker.config.mjs` | `b261aa5ed498f18eb9cd0e7c97ffda8df430a8b46c147ec6bab0273c5b16fb38` |
| `apps/web/scripts/check-runtime.mjs` | `1f99a88f1d27ec3babb8280a8fdc4264ea90db35997e29f0b08ce0f677405ea9` |
| `apps/web/public/index.html` | `20b910b9079c52dc5daca3d6d12eb63d60f0420a0d2fccc9e2d5ee536cce928d` |
| `apps/web/src/main.tsx` | `7adfb379aecfceb89440af39cd0aa1994129d367651527a7065eb3b3b03af663` |
| `apps/web/src/poc/PocApp.tsx` | `c071399c655f6e1cf14304479bc1edfecbaf894da1157c23e6896723cda285c2` |
| `apps/web/src/poc/PocApp.module.css` | `001456f07f1c6baef9411f987021e880de2654750083b1e2de577673b212d737` |
| `apps/web/src/poc/editor-state.ts` | `dd5aaef6eadf26de944d639ab74b04f47f3ab645dbe8fea88c819733fd185caa` |
| `apps/web/src/poc/editor-state.test.ts` | `30a77b9c084e20b01907c7e271535badef435478525d2fbf13a69a975fff7c00` |
| `apps/web/src/poc/styles.d.ts` | `c4387a8b3a19464901ad321d481b8a0d4ee5f963411e68273f98d180f2fe4641` |
| `apps/web/tests/poc/e2e/phone-flow.spec.ts` | `28dda3bc17d65b934217ab35faed2505aaed78559fb769d6e6bc3e1e17aa6856` |
| `docs/poc/README.md` | `ba18549a8d2ed8f45c32276cf1389830b0118f553606ec610d1caa4169b70b17` |
| `docs/poc/screenshots/phone-poc-initial.png` | `4765b6c4c94c1d60156f12b592f9c08447bb4db42a1c3e6f68799d18af04d4fc` |
| `docs/poc/screenshots/phone-poc-focus.png` | `4ffebb565be85d31228374be6c21464f160ea96f3c745bf1a328a55b0c9246f2` |

## Known gaps and non-claims

1. No physical iPhone/Samsung evidence, touch/pinch, keyboard, orientation,
   WebGL/WebGPU or performance trace exists; the current browser viewport and
   its 44×44 target regression check are not device certification.
2. No durable Project/Revision, history, backup/recovery, PWA installation,
   browser storage, service worker or offline claim exists.
3. No API, authentication, catalogue, asset policy, custom import, Kotlin or
   PostgreSQL module exists. `apps/catalog-control-plane` remains closed until
   `G-CP-ADR`.
4. The Stryker command runner is deliberately scoped to one reducer and uses
   in-place backup/restore because Rstest lacks a dedicated runner. It is not
   yet a scalable alpha mutation architecture.
5. The loopback dev server is intentionally inaccessible from a physical phone
   on the LAN; an authorized local-network mode is a separate decision.
6. `/.playwright-cli/**` is ignored local diagnostic residue, not handoff
   evidence; only the two named PNG captures above are durable POC visuals.

## Disposition

`owner_disposition: pending-review`; `closed_at: null`.

The POC remains active for bounded work; this evidence record is the
read-only snapshot. The POC cannot be silently relabelled, deployed or treated
as production. A future accepted closure must add the owner disposition and
`closed_at` without changing the bounded scope.

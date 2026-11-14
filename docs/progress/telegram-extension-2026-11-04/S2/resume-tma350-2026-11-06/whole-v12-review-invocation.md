# Full TMA350 independent review invocation

Run the frozen read-only auditor from the actual verification app directory. The strict Node17 validator resolves relative raw case-marker paths against this working directory.

```sh
cd /tmp/interiors-resume-tma-20261106-owned/workspace/apps/web
/Users/romanzheltov/.npm/_npx/09ae5d3560c7b1f2/node_modules/node/bin/node /tmp/interiors-resume-tma-20261106-owned/full351-independent-replay.mjs
```

Do not pass `--partial` for final review. This invokes no Native child and writes no app input. Auditor SHA256: `8ce3c15d71f663dc89eddfd68dff418301a18d347294087340ce9ec6ec73c8b0`. Frozen record: `e8f31c3b06e7bed40978331cb07b57868687b9172ae15e7f92ec57176802bb94`; profile: `dcf21d792dfa7c8f443c04b4e6c5ae70905a2147ed3f2b58fd3383d6e424d9ee`.

Expected verified facts:351 actual calls (baseline+350),308 K/42 S,88% at unchanged80% threshold; original17 CPU and145 Native corpus;1007 plain input keys restored exactly and no remaining/unproven owned groups. The owner result binds `whole-v12-full351-independent-replay.json` SHA256 `730777b2d69de2b8d0311462c8d4befa9fb3991ef8a9a39c9a5ade8df4aeb3aa`. Whole acceptance remains a separate Root independent ACK.

The original short handoff omitted the required cwd. An invocation from the repository root fails strict relative identity binding and must not be treated as a successful audit. Use the actual app cwd; do not alter raw data or policy to accommodate another cwd.

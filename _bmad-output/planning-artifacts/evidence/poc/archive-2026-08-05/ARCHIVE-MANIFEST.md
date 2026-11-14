# Archived W-POC byte verification — 2026-08-05

This non-runtime snapshot is an immutable, byte-for-byte evidence copy made
before the POC-bound root and web configuration were replaced. It includes
source, tests, configuration, lockfile, POC handoff and human-facing POC
documentation only. It intentionally excludes dependency folders, build output,
test/mutation reports, caches, generated bundles and binary screenshots.

The two original screenshots remain at their prior non-runtime documentation
paths; their pre-replacement SHA-256 values are recorded in the adjacent
closure record. Each snapshot copy below was compared to its original path
before production changes. `verified` means the two SHA-256 values matched.

| Original path | Snapshot SHA-256 | Original SHA-256 | Result |
| --- | --- | --- | --- |
| `.gitignore` | `d3a60e6ae8a8fe820e2b25842dc13689af338ba11e7bdebf5d550ab528c5e55e` | `d3a60e6ae8a8fe820e2b25842dc13689af338ba11e7bdebf5d550ab528c5e55e` | verified |
| `.npmrc` | `260b49519991597521e955d1b18ea0d7b423167daf79b32d47b18855de14e7d3` | `260b49519991597521e955d1b18ea0d7b423167daf79b32d47b18855de14e7d3` | verified |
| `.nvmrc` | `7e8a2fa94951112b894a3dbe3d05efef5e9263741fa49125f0a70f40fedab4cc` | `7e8a2fa94951112b894a3dbe3d05efef5e9263741fa49125f0a70f40fedab4cc` | verified |
| `README.md` | `6a530ea6fcabf6ab6f72474c6e167f1ff0c2370ff5c05bb2ac5874d804473a90` | `6a530ea6fcabf6ab6f72474c6e167f1ff0c2370ff5c05bb2ac5874d804473a90` | verified |
| `_bmad-output/planning-artifacts/evidence/poc/phone-editor-poc-handoff-2026-08-04.md` | `ec272f50e2136f2842a9c681a96efe5d501386a71c320f78357807bfdb41fc9c` | `ec272f50e2136f2842a9c681a96efe5d501386a71c320f78357807bfdb41fc9c` | verified |
| `apps/web/package.json` | `8a8755101e271c5e480b7b6b17bb1f1b513f32d8298771705a0944811be24c4a` | `8a8755101e271c5e480b7b6b17bb1f1b513f32d8298771705a0944811be24c4a` | verified |
| `apps/web/playwright.config.mjs` | `65e0f9541d60c69cabcc25f99c66c9b817733c62c4261af00e58a692ee3692ea` | `65e0f9541d60c69cabcc25f99c66c9b817733c62c4261af00e58a692ee3692ea` | verified |
| `apps/web/public/index.html` | `20b910b9079c52dc5daca3d6d12eb63d60f0420a0d2fccc9e2d5ee536cce928d` | `20b910b9079c52dc5daca3d6d12eb63d60f0420a0d2fccc9e2d5ee536cce928d` | verified |
| `apps/web/rspack.config.mjs` | `7e603b16dff492ca5c119a627fea7906229038374eea794590aeb11a574fe9d7` | `7e603b16dff492ca5c119a627fea7906229038374eea794590aeb11a574fe9d7` | verified |
| `apps/web/rstest.config.mjs` | `5ab2c32f8998c3184b03db6bae8da5350760abe3ed781a5b676f72fa1c363d15` | `5ab2c32f8998c3184b03db6bae8da5350760abe3ed781a5b676f72fa1c363d15` | verified |
| `apps/web/scripts/check-runtime.mjs` | `1f99a88f1d27ec3babb8280a8fdc4264ea90db35997e29f0b08ce0f677405ea9` | `1f99a88f1d27ec3babb8280a8fdc4264ea90db35997e29f0b08ce0f677405ea9` | verified |
| `apps/web/src/main.tsx` | `7adfb379aecfceb89440af39cd0aa1994129d367651527a7065eb3b3b03af663` | `7adfb379aecfceb89440af39cd0aa1994129d367651527a7065eb3b3b03af663` | verified |
| `apps/web/src/poc/PocApp.module.css` | `001456f07f1c6baef9411f987021e880de2654750083b1e2de577673b212d737` | `001456f07f1c6baef9411f987021e880de2654750083b1e2de577673b212d737` | verified |
| `apps/web/src/poc/PocApp.tsx` | `c071399c655f6e1cf14304479bc1edfecbaf894da1157c23e6896723cda285c2` | `c071399c655f6e1cf14304479bc1edfecbaf894da1157c23e6896723cda285c2` | verified |
| `apps/web/src/poc/editor-state.test.ts` | `30a77b9c084e20b01907c7e271535badef435478525d2fbf13a69a975fff7c00` | `30a77b9c084e20b01907c7e271535badef435478525d2fbf13a69a975fff7c00` | verified |
| `apps/web/src/poc/editor-state.ts` | `dd5aaef6eadf26de944d639ab74b04f47f3ab645dbe8fea88c819733fd185caa` | `dd5aaef6eadf26de944d639ab74b04f47f3ab645dbe8fea88c819733fd185caa` | verified |
| `apps/web/src/poc/styles.d.ts` | `c4387a8b3a19464901ad321d481b8a0d4ee5f963411e68273f98d180f2fe4641` | `c4387a8b3a19464901ad321d481b8a0d4ee5f963411e68273f98d180f2fe4641` | verified |
| `apps/web/stryker.config.mjs` | `b261aa5ed498f18eb9cd0e7c97ffda8df430a8b46c147ec6bab0273c5b16fb38` | `b261aa5ed498f18eb9cd0e7c97ffda8df430a8b46c147ec6bab0273c5b16fb38` | verified |
| `apps/web/tests/poc/e2e/phone-flow.spec.ts` | `28dda3bc17d65b934217ab35faed2505aaed78559fb769d6e6bc3e1e17aa6856` | `28dda3bc17d65b934217ab35faed2505aaed78559fb769d6e6bc3e1e17aa6856` | verified |
| `apps/web/tsconfig.json` | `9f4368c4d18d145dd1473906391dca3ddf62893775a0aa44d1b2d1b610b2888e` | `9f4368c4d18d145dd1473906391dca3ddf62893775a0aa44d1b2d1b610b2888e` | verified |
| `docs/index.md` | `51b7867ff9274e7917c97da5f3d74020b0dd577c05c8a013949493cc795d467d` | `51b7867ff9274e7917c97da5f3d74020b0dd577c05c8a013949493cc795d467d` | verified |
| `docs/poc/README.md` | `cc24b38b6d0ac244d4e603b75f9af3a98a9d41a9658794e890cc14a8c52f6446` | `cc24b38b6d0ac244d4e603b75f9af3a98a9d41a9658794e890cc14a8c52f6446` | verified |
| `package.json` | `3cafd3aaa6b41e3266e84f84419ec131ec12c76e819925fe074cfba30b8037b0` | `3cafd3aaa6b41e3266e84f84419ec131ec12c76e819925fe074cfba30b8037b0` | verified |
| `pnpm-lock.yaml` | `544d0a168a5568e1d0c3243d202fa1adb0fa4cc26e724ad67d9587c849d9069b` | `544d0a168a5568e1d0c3243d202fa1adb0fa4cc26e724ad67d9587c849d9069b` | verified |
| `pnpm-workspace.yaml` | `d2e75aa6b27ba385e62bcdf97da938b30263e96d85c958a17eef1efa3aec8b80` | `d2e75aa6b27ba385e62bcdf97da938b30263e96d85c958a17eef1efa3aec8b80` | verified |


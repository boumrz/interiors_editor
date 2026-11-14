# PRELIMINARY explicit readonly profile v2: source/types only

Additive API remains one OPTIONAL top-level dependency field:

```ts
readonly coordination?: "scoped-lock" | "native-readonly-snapshot";
```

Default scoped-lock still requires an actual lock port. Explicit native-readonly-snapshot does not even read its request property; production chooses it only when Web Locks are missing. It relies on owned single-native-readonly-TX snapshots and final exact expected-Revision/full-proof CAS, not a writer fallback. It preserves secure actual readable permit/scope admission, native schema/metadata identity/counter floor, sticky revocation, exact resources/hash/registered codec/smoke checks, synchronous signal revoke and drain of started work/native transactions. No provision, upgrade, writer IDs/fences/leases, reconciliation, migration, GC, prefs or network.

Independent review found sparse resource roots: the new helper now requires dense actual own canonical index keys before walking/deduplicating roots. It rejects holes and extra enumerable metadata properties without allocating or looping by a corrupt sparse length; no new numeric root cap was invented. Shared74ff remains untouched.

Genuine TDD: initial profile RED2 ->15GREEN; unused request getter RED1 ->16GREEN; sparse roots RED1 ->17GREEN. Current scoped TypeScript exit0 and scoped Biome lint4 exit0/no findings. CURRENT full native39-case matrix and required whole-source/helper mutation are PENDING. Old native2acf/aa82 is historical only. Copying real types for Root entry tests is not activation/native acceptance/READY.

This supersedes preliminary ap751 source516 packet. Expected original hashes are the initial hn5se9bj root copy: main2acf/helper ebec and its two tests. Four changed files only. Root owns originals and must hashguard integration; future native findings will arrive as separate deltas against this packet. No ongoing common74ff or original source edits.

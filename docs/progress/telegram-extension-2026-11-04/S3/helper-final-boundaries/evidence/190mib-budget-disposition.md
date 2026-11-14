# Exact scope of remaining envelope arithmetic survivors

Source SHA38710fc55101133033f6d381501db5ad22a90f39e362e5a883a386e2eebcdcff. Analysis only; no replacement full623 run or adjusted denominator.

The initial attempt to make a 10MiB valid Project by using4KiB free strings failed the real `copyProject` prerequisite. `isStructurallyValidProjectV1` caps each free string at256 UTF16 code units; the failed fixture was removed from the test tree and is not offered for integration. That failure is not a product regression or a passing boundary test.

`resourceReferences` is reached only after `legacyProject` succeeds. The current copy/reader checks enforce V1 fixed member lists,600 vertices,300 walls,50 rooms,200 openings,250 asset instances and250 definitions. Successful legacy walk also excludes custom prototypes, functions/accessors, non-enumerable/extra properties, holes, non-scalar loss and over-deep containers.

For a bound, an arbitrary256-unit JSON string uses at most1538 raw bytes including quotes (six bytes per UTF16 code unit is conservative even for lone units; the accepted subset is narrower). Finite JSON numbers use at most25 ASCII bytes. Enumerated colors/hashes/provenance/kinds are fixed or strictly bounded. Accepted plain colorVariantId arrays can only form a single-child chain to a known color ID: multiple children introduce commas incompatible with every allowed variant; depth<=8 bounds its brackets. The following deliberately rounded per-entity raw budgets include fixed property names, punctuation, maximum optional values and numeric fields:

| Component | Maximum count | Conservative bytes each |
|---|---:|---:|
| Project/Level headers, native identity reserve, all outer-array separators |1|8192|
| Vertex |600|2048|
| Wall |300|5120|
| Room |50|5120|
| Opening |200|4096|
| Floor/wall item |250|7168|
| Resource definition, including optional catalog provenance |250|7168|

Total raw Project+future identity reserve <=7,432,192 bytes (7.08789MiB). The resource byte guard remains180MiB, and successful V1 reader limits actual unique definitions to250, so the same old STORE upper formula is <=180MiB+7,432,192+3072+1024*250 = 196,434,944 bytes (187.33496MiB), strictly below190MiB.

- Historical274/275/276 change only private `upper` arithmetic. Original private upper never crosses190 under the unmutated prerequisites above; the mutated alternatives do not create a new rejection for this positive domain. Narrow current-policy domination, not global algebraic equivalence.
- Historical286 removes190 comparison and287 changes `>` to`>=`: exact190 cannot occur under the same current prerequisites.
- Historical289/290 concern280MiB. These have a separate simpler domination: the unmutated lower190 guard already rejects any value that could distinguish the280 test, irrespective of the tighter V1 cardinality bound.

Keep all guards and all raw survivors. Any change to V1 reader/member/string/cardinality rules, accepted plain variant semantics, resource limits, identity reservation or STORE overhead invalidates the corresponding proof and requires fresh boundary tests/review. This argument does not waive preparse limits, allocation safety outside these already-owned V1 values, or current native/physical/IDB protocol checks.

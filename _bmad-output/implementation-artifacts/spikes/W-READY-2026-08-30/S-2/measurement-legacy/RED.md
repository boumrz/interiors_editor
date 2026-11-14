---
title: "S-2 detached TCC-A1 measurement and legacy RED record"
status: observed-red
date: 2026-08-30
authority: bounded readiness evidence spike waiver W-READY-2026-08-30
scope: "Measurement/projections and Legacy/ingress-boundary only"
---

# RED — no executable source-TCC route exists for these two families

This record is intentionally written before any candidate fixtures.  It tests
the product evidence claim, not product behavior:

> The adopted TCC-A1 executor can execute immutable fixtures for both
> `measurement-and-projections` and `legacy-and-ingress-boundary` with the
> source contract's expected outcome shape.

The assertion is false in the current product.  The existing current-product
manifest records both families as `not-executable-as-tcc-a1`.  The adopted
runner accepts only `executorRole: domain-kernel`, four geometry-reject reasons
and three materialization transients.  It has no outcome contract for a
measurement observation (`measured`, `stale`, or `target-unavailable`) and no
`legacy-classifier` executor role.

The RED command below must exit with status 1 until those adopted routes are
implemented and independently reviewed.  It is deliberately read-only and
does not create a Project, Revision, History entry, resource pin or publish.

```sh
node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync("_bmad-output/planning-artifacts/evidence/spikes/S-2/current-product/tcc-a1-current-product-manifest-2026-08-30.json","utf8")); const wanted=new Set(["measurement-and-projections","legacy-and-ingress-boundary"]); const rows=m.audit.familyDisposition.filter(x=>wanted.has(x.family)); const complete=rows.length===2 && rows.every(x=>x.status==="passed"); console.log(JSON.stringify({complete,rows},null,2)); process.exit(complete?0:1)'
```

This spike may record immutable raw candidates and current supporting-test
observations after RED.  It must not label them TCC-A1 `accepted`,
`rejected`, `transient`, or legacy-classified evidence unless an adopted
executor supplies the exact source-contract outcome.

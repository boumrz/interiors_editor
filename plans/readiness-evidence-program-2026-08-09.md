# Plan: readiness evidence program

**Status:** Active — no readiness verdict yet  
**Authority:** `readiness-evidence-program-waiver-2026-08-09.md`  
**Gate:** A future fresh `bmad-check-implementation-readiness` workflow must
report its actual verdict.

## Goal

Produce a reviewable, reproducible evidence corpus for every pre-bootstrap
readiness gate, while keeping external proof obligations explicitly external
and never treating browser emulation or agent assertions as their substitute.

## Scope correction — 2026-08-25

Licensing is not an Alpha readiness obligation. Any older reference in this
historical program to `AssetUsageGrant`, legal/provenance admission,
attribution, notices or rendered-output rights is superseded. Current catalog
evidence is technical only: format/size/hash, exact pin,
`BackupFeasibilityPolicy`, recovery and self-contained backup.

## Truth boundaries

- The present official status is `NOT_READY`.
- User approval permits internal implementation and preparation, not participant
  observation, independent human review, physical-device
  traces or a release claim.
- Every code slice requires its own approved observable acceptance criteria,
  TDD, focused mutation evidence and the full local quality gate.
- `SPEC.md`, PRD and Architecture decisions are changed only through their
  owning fresh BMAD workflows.

## Completed internal milestone — S2-00 corpus spine

**Status:** Complete as a pre-adoption scaffold; it is not a selected kernel,
`G-S2` result, independent review, or readiness verdict.

- Added `apps/web/src/domain/topology-corpus.ts`: versioned corpus metadata;
  input-only executor seam; deterministic accepted, invalid-ingress,
  fractional-contact, stale-fence and cancellation vectors; allocation intent,
  inverse-to-base and no-mutation declaration checks.
- Added public behavior coverage in `topology-corpus.test.ts`, including
  full-corpus ordering, partial failure, executor-input isolation, mismatch
  reason codes and invalid declaration refusal.
- Local evidence on 2026-08-09: Rstest 288/288, both TypeScript configurations,
  Biome lint, a temporary-output production build (entry `main.js` 193,080
  bytes), full Playwright 26/26, and isolated Stryker mutation 187/187 killed
  for `src/domain/topology-corpus.ts`.
- A test-seam readiness race exposed by the full browser run was corrected:
  browser tests now wait for the development-only control before setting delay
  or fault, so a missing seam cannot silently turn a failed-publication test
  into a successful save.

The corpus has no selected runtime or authoritative fixture hashes yet. The
fresh Architecture decision, the actual kernel, expanded corpus, browser
adapter vectors and independent review remain in `G-S2`.

## Completed documentation milestone — AD-20 ownership synchronization

**Status:** Complete as a bounded Architecture → SPEC synchronization; it is
not topology evidence, a spike result, a legacy migration decision or a
readiness verdict.

- Fresh `bmad-architecture update` adopted AD-20: a domain-owned constrained
  `PlanGraph` kernel is canonical; an external geometry engine can be only an
  immutable test oracle/fixture adapter.
- Fresh `bmad-spec update` synchronized the Spine decision into `SPEC.md`, the
  glossary, Geometry and Project/Backup companions, while preserving the
  draft specification and unchanged CAP-1…CAP-12.
- At this AD-20 synchronization, existing V1/V2 remained characterization
  material. Classification, migration/handoff and legacy-to-canonical
  stable-reason mapping were explicitly deferred to a later source-owned matrix
  and versioned corpus before any Durable path.
- Both workflows passed their bounded reviewer/validation gates; neither
  asserted `READY`, implementation completion, external evidence or release
  readiness.

## Current documentation follow-on — Portable Backup ingress source ownership

**Status:** Complete as a source-owned documentation contract; it is not
importer, corpus, device, independently attributed review or readiness evidence.

- The fresh `bmad-spec` update now source-owns the closed PPJ-A1 schema registry,
  exhaustive raw geometry pointer registry, empty serialized-Command registry,
  raw path/schema traversal and existing-reason precedence.
- Its V1/V2 matrix keeps legacy fixtures quarantined: only a valid,
  checksum-valid, AST-R1-admitted current envelope reaches
  `BACKUP_SCHEMA_UNREADABLE`; all earlier reasons remain intact, and migration,
  pinning, ID/Revision/Project publication or production handoff remain forbidden.
- AST-R1 and matching current Project limits are source-owned; the same
  canonical dry-count preflight is required before Durable publication. This is
  a documentation contract, not proof of a parser, exporter or exportability run.

## Completed internal slice — S2-01 lossless interactive wall-geometry resolution

**Status:** Complete as a narrow internal resolver evidence slice; this is not
`G-S2` closure, an independently attributed geometry review, or a complete
topology preflight. The user’s 2026-08-09 authorization to perform the work
needed toward an honest gate result was the approval for this bounded internal
slice.

**Actor:** the numeric/touch adapter after it has retained raw interactive text.

**Trigger:** it requests an endpoint, delta, or explicit-quadrant
length-only diagonal wall geometry resolution.

**Outcome:** raw string lexemes are checked before number coercion, lexical
`-0` becomes canonical `0`, an allowed cardinal/45-degree result exposes a
fresh compile-time-`readonly` resolved endpoints/delta/direction value and
ephemeral exact squared length, or the adapter receives the source-owned stable
rejection. The function does not mutate its raw input, allocate IDs or mutate a
Project because it receives neither.

**Scope:** interactive raw lexemes, signed safe-integer-mm ingress, coordinate
hard-bound admission, direct cardinal/45-degree classification and exact
`L / √2` diagonal quantization using ephemeral `BigInt` arithmetic.

**Explicit exclusions:** `project/project.json` raw-byte parsing and backup
reason mapping; empty/non-empty Plan fixture hashing; contacts/T/X, faces,
Rooms, Openings and hosts; too-short/overlength/thickness policy mapping until
a source owner assigns the missing stable reason; base/checksum/fence/cancel;
ChangeSet/inverse/ID allocation; persistence, UI wiring and browser evidence.
A complete `AddWallSegment` preflight must add all of those according to
Geometry Contract §5 and AD-7; S2-01 must never be called that preflight.

**Observable acceptance criteria:**

1. Reject malformed, decimal, exponent, unsafe and already-coerced input as
   `INVALID_DIMENSION`; normalize raw `-0` before any geometry result.
2. Accept only exact E/NE/N/NW/W/SW/S/SE endpoint or delta directions;
   zero is `ZERO_LENGTH` and any other slope is `UNSUPPORTED_DIRECTION`.
3. Require an explicit diagonal quadrant and resolve length-only diagonals by
   the exact integer predicate, not `Math.sqrt`, `Math.hypot` or rounding.
4. Enforce only the source-mapped coordinate hard bound as
   `PROJECT_BOUNDS_EXCEEDED`; do not invent a reason for later wall-length or
   thickness materialization checks.
5. Finish RED/GREEN tests, focused mutation, full local test/type/lint/build
   gates and a separate read-only code review before recording the slice as
   complete.

**Local evidence on 2026-08-09:**

- Tests cover malformed/envelope/enum handling, raw grammar and `-0`, unsafe
  values, all eight exact directions, four explicit diagonal quadrants,
  1 mm/1000 mm/1414 mm/1415 mm diagonal cases, inclusive and crossing
  coordinate bounds, and stable rejection/no input mutation.
- An isolated Stryker run in a disposable copy produced 293 mutants: 280
  killed, 2 caught timeouts (intentional non-terminating Newton-loop changes),
  and 11 surviving equivalent/dead mutations, for 96.25%. The survivors are
  exhaustiveness after a validated finite union, zero comparisons after zero
  rejection, parity-impossible equality of an odd square and `2L²`, a
  lower-bound predicate implied by its construction, and the absence of a
  negative BigInt zero. It is not represented as an unreviewed 100% score.
- Full local evidence: Rstest 348/348, both TypeScript configurations, Biome
  lint (107 files), temporary-output production build (entry `main.js`
  193,080 bytes), and Playwright 26/26.
- A separate final read-only review found no P0/P1. That review is internal
  code review only; the independently attributed geometry/corpus review and
  target-environment replay required by `G-S2` remain open.

## Active internal slice — S2-02a bounded PPJ raw JSON AST

**Status:** In progress as a deliberately lower-level raw-byte seam. The
source-owned AST-R1 contract and parser implementation now bound depth, nodes,
member/array edges, parent-link pointer reconstruction, decoded strings,
numeric tokens and abstract retained metadata. A deliberately production-
unreachable staged-member adapter now proves the bounded-member → incremental
checksum → AST ordering with injected ports, but the canonical PPJ corpus and
a concrete archive/durable-staging adapter remain open. It is not the PPJ-A1
closed-schema boundary, a `.interiors` archive importer, migration, resource
validator or publication path.

**Actor:** a future PPJ-A1 schema boundary after a container adapter has made
the canonical member path safe and staged its bytes.

**Pipeline precondition and seam outcome:** the upstream pipeline rejects a
member above the source-owned 10 MiB guard as `BACKUP_PROJECT_LIMIT` and a
bounded-member checksum mismatch as `BACKUP_CHECKSUM_MISMATCH`; S2-02a begins
only after both boundaries have passed. A syntactically valid continuation that
then crosses AST-R1 is `BACKUP_PROJECT_LIMIT`; malformed UTF-8/JSON or a
duplicate decoded member name is `BACKUP_SCHEMA_UNREADABLE` under the registry's
exact byte/name precedence. The seam returns only the bounded AST with raw
numeric lexemes and parent/source-span pointer links (a bounded RFC 6901
diagnostic pointer is reconstructed only on demand), and creates no
Project/ID/Revision allocation. It deliberately performs no schema selection or
host-number coercion.

**Explicit exclusions:** archive/path/manifest/checksum computation (the seam
starts only after their successful upstream boundary); PPJ-A1 closed shape and
scalar rules; ProjectLimits other than the 10 MiB/AST-R1 resource envelope;
V1/V2 classification; migration; resource/provenance validation;
ID/Revision/History/project mutation; UI and physical-device evidence.

**Acceptance criteria:** parser tests must cover raw `-0`/decimal/exponent
retention, parent-link/RFC-6901 reconstruction, decoded duplicate names,
invalid grammar, valid/invalid UTF-8, every independently reachable AST-R1 cap,
all-hard-count metadata formula and byte/name precedence at a same-boundary
fault. It must include a unique root name of 128 decoded ASCII bytes: its
prospective 129-byte child pointer fails `BACKUP_PROJECT_LIMIT` at the closing
quote before colon/value and reserves no `pointerLinks` term. It must separately
exercise a reachable duplicate/capacity boundary (32 distinct short members in
one object followed by a duplicate decoded name), proving the duplicate remains
`BACKUP_SCHEMA_UNREADABLE` before a 33rd member-record reservation, and a
malformed UTF-8/JSON vector before a completed name, proving syntax precedence.
Separate upstream/container-adapter integration evidence must prove the inclusive
10 MiB byte guard and checksum-before-AST ordering; S2-02a consumes only
bounded, checksum-passed member fixtures. Parser evidence must also cover
accepted all-hard-count dry count, just-over-structural-cap and cancel/crash
cleanup vectors. Focused mutation, the full local gate and a separate review
decide whether this low-level seam is complete. A schema validator may consume
the AST only after S2-02a is complete.

**Current local evidence on 2026-08-10:**

- `ppj-a1-lossless-json.ts` is an allocation-free raw-byte AST seam with no
  V1/V2 import, no document-level `JSON.parse`, duplicate decoded-key
  rejection, raw numeric lexemes, parent/source-span links and on-demand
  bounded RFC 6901 pointer reconstruction.
- Its public suite has 100 cases covering primitive/number retention, `-0`,
  decimal/exponent grammar, valid/invalid UTF-8 endpoints and malformed
  widths, escaped Unicode byte accounting through 4 KiB, ASCII/escaped/non-BMP
  128/129-byte pointer boundaries, duplicate/capacity precedence, each
  independently reachable AST-R1 structural cap, and scalar-only escaped
  Unicode: lone high/low surrogate values and member names reject as
  `BACKUP_SCHEMA_UNREADABLE`; valid pairs count as one four-byte scalar.
- The earlier parser Stryker report (738 mutants, 86.04%) is retained only as
  historical characterization. It predates the new scalar-only source rule
  and is therefore not evidence for the exact current parser; an updated
  isolated parser mutation run remains required.
- `ppj-a1-staged-project-member.ts` is a narrow, port-owned integration seam:
  prechecked and actually streamed inclusive 10 MiB guards precede AST;
  source bytes are copied into staging, then copied from one staged snapshot
  into separate checksum and AST buffers. A checksum mismatch therefore blocks
  every raw UTF-8/JSON traversal. Every opened lease is discarded; cancellation
  races an uncooperative `next()` and invokes iterator cleanup without allowing
  a synchronous `return()` failure to skip staging cleanup. Its 19 behaviour
  cases include staged replacement/TOCTOU, producer and checksum mutation,
  source cancellation and only-unreachable recovery, and assert no
  Project/Revision/ID/publication effect.
- A new focused adapter Stryker run on the immediately preceding fixture
  snapshot recorded 163 mutants: 113 killed, 3 timeout detections and 47
  survivors. The same-length malformed UTF-8 checksum-before-AST vector was
  strengthened afterwards, so this report is diagnostic only and must be
  rerun; it is not represented as a pass or a score for the current snapshot.
- The parser also rejects malformed UTF-8 before an object-member name can
  complete, as required by AST-R1 syntax precedence.
- Current focused verification is Rstest 119/119 across parser and staged
  adapter, both TypeScript configurations and Biome lint (111 files). The full
  Rstest/build/Playwright gates must be rerun after this exact snapshot.
- Separate read-only review found no P0/P1 after the same-length malformed
  UTF-8 correction in the staged adapter. This is internal review, not the
  independently attributed evidence required by `G-S2` or a readiness verdict.
- A Fallow production-only scan reports both the parser and staged adapter as
  unreachable from production entry points. That is expected until a later
  approved container/schema adapter consumes the seam; it is evidence against
  silently presenting S2-02a as an import or durable production path.

**Open acceptance evidence:**

1. No canonical versioned PPJ corpus or accepted all-hard-count dry-count
   harness exists yet.
2. The narrow staged-member protocol is covered, but no concrete
   `.interiors` container adapter with a real incremental checksum and durable
   staging journal proves the same ordering against real archive bytes.
3. Cancellation and only-unreachable cleanup are covered through injected
   stage ports, but no durable staged owner demonstrates reload after a real
   crash or quota/storage fault.
4. The fresh source-owner SPEC decision for scalar-only escaped Unicode is
   implemented locally, but its parser mutation rerun and full local gate are
   still required for this exact code snapshot.
5. The required malformed UTF-8/JSON vector before a completed object name is
   covered; independent review and target-environment replay remain open.

## Queued internal slice — S2-02b PPJ-A1 closed schema boundary

**Status:** Queued pending final validation of the source-owned Portable Backup
ingress registry. It is not a `.interiors` archive importer, migration,
resource validator, recovery path, or atomic publication path.

**Actor:** a future archive/container adapter only after it has made the
canonical member path safe, validated the manifest/checksum and bounded the
raw UTF-8 Project member.

**Outcome:** the boundary parses the raw PPJ-A1 document losslessly, rejects
duplicate keys, closed-shape/schema-selector failures and every invalid or
unregistered number as `BACKUP_SCHEMA_UNREADABLE` before host-number coercion,
then returns an allocation-free typed snapshot for later ProjectLimits/domain
validation. It uses neither `decodeProjectV2` nor a legacy schema as an
implementation dependency.

**Explicit exclusions:** archive central-directory/path normalization,
manifest parsing/checksum verification, ProjectLimits/counts, V1/V2 migration,
resource/provenance validation, ID allocation, Revision/History mutation,
staging/publish, UI and physical-device evidence. Those are independently
observable later stages in the Portable Backup ingress registry.

**Planned acceptance criteria:**

1. A bounded lossless JSON AST retains raw numeric lexemes, does not use
   `JSON.parse` as numeric acceptance and rejects duplicate object keys.
2. PPJ-A1 accepts only the exact registered root selector and closed pointer
   grammar, including every registered repeated/discriminated placement branch
   and the intentionally empty Command/history registry.
3. Every registered geometry/ordinal token is checked as raw safe integer and
   canonicalizes accepted `-0`; unregistered JSON numbers and all malformed,
   decimal, exponent, unsafe or wrong-type values reject stably before a
   typed snapshot exists.
4. Tests demonstrate no V1/V2 fallback, no input mutation, no allocation and
   no publication; focused mutation, full local gates and separate code review
   are required before the slice can be recorded complete.

## Execution tracks

### Track A — topology/kernel (`G-S2`)

#### Active internal slice — TCC-A1 manifest runner and empty-plan wall candidate

**Status:** Complete as a deliberately detached internal seed (2026-08-10).
This is not a complete `PlanGraph` kernel, a topology `G-S2` result, a durable
command, or a readiness verdict.

**Scope:** introduce a new TCC-A1-shaped manifest/runner beside (not inside)
the old pre-adoption corpus scaffold, and one allocation-free candidate command
for a wall in an otherwise empty plan. The command may use only the clean
S2-01 raw-geometry resolver. It must not import or promote `Project` V1,
`ProjectV2`, V1/V2 codecs, legacy wall commands, derived legacy faces, React,
storage or publication code.

**Observable acceptance criteria:**

1. A manifest declares the exact TCC-A1 contract id/version, positive revision,
   the currently supported `domain-kernel` executor role, immutable fixture id, raw input bytes with a lowercase
   SHA-256 declaration, policy references, semantic intent, base digest and
   expected outcome. The runner rejects malformed declarations, duplicate ids,
   missing policy/hash/expectation and a hash mismatch before it invokes an
   executor.
2. The executor receives only fresh immutable copies of fixture bytes, the base
   digest and semantic intent; it never receives the expected outcome. A run
   compares accepted post/inverse digest, ordered allocation-intent labels and
   fixture opaque candidate references, and compares stable rejection reason,
   unchanged digest and empty allocation intent.
3. The first command derives an empty-plan wall candidate from the S2-01 raw
   endpoint/delta/explicit-quadrant input. It is limited to that initial
   candidate: no contacts, faces, Rooms, hosts, thickness, durable IDs,
   ChangeSet, history, fence or publication are claimed. Accepted candidate
   references are fixture-only allocation placeholders; no allocation occurs.
4. Invalid raw input is passed through as the existing source-owned stable
   geometry rejection with the empty-plan digest and no allocation intent; the
   raw input remains unchanged. The first corpus includes at least one accepted
   exact 45-degree case and one stable raw-ingress reject.
5. Work follows RED/GREEN TDD, has focused mutation evidence and an independent
   read-only review before this slice can be marked complete. Full local gates
   are supporting evidence only and cannot declare `READY`.

**Explicit exclusions:** non-empty PlanGraph mutation, contacts/T/X,
faces/usable polygons, lineage/hosts, measurements, stale/cancel/fence policy,
legacy classification/migration, browser/UI wiring, storage and durable
publication. The mandatory TCC-A1 families remain open beyond this small seed.
`test-only-oracle` and `legacy-classifier` need their own later
role-discriminated outcome contracts; this seed runner must not pretend to
support either one.

**Completion evidence (2026-08-10):** RED established the absent runner and
candidate seam before implementation; the focused domain suite passes 55/55.
The exact current source had an isolated Stryker run: 462/491 mutants killed,
0 timeouts, 94.09% mutation score. The report records the remaining 29
survivors for later corpus expansion; none is represented as proof that the
full TCC-A1 contract is complete. An independent read-only code review found
no active P0/P1/P2 in this seed scope. Full supporting gates pass: Rstest
522/522, runtime/typecheck, Biome lint (116 files), production Rspack build,
and Playwright 26/26 (24 editor plus 2 PWA). A source scan verified that the
three new modules do not import V1/V2, legacy wall commands, derived legacy
faces, storage, React or publication code.

1. Run a fresh source-owner decision workflow for the selected kernel/library,
   tolerance/rounding, 0°/45° ingress, T/X policy, Room reconciliation,
   Opening relocation and lineage/inverse rules.
2. Version the golden/property/hostile corpus independently of the old S-2
   spike; no spike source is promoted.
3. Implement one observable topology command at a time only after its policy
   is adopted; start with a numeric 0°/45° wall candidate whose rejection has
   no durable mutation.
4. Obtain an independently attributed geometry/corpus review and target
   environment replay.

### Track B — local durability (`G-V01-S3`, backup and limits)

1. Run the fresh storage decision package: resource substrate, transaction
   fence, root inventory, migration and safe-update boundary.
2. Deliver writer fencing as the first observable durability slice: a second
   context opens one Project read-only, takes over explicitly, and the former
   writer cannot publish.
3. Add resource roots/recovery, then `.interiors` import/export and hostile
   backup corpus in separate slices.
4. Collect real iOS/Android lifecycle, quota, update and Safari↔Home-Screen
   evidence with an accountable owner and reviewer.

### Track C — rendering and mobile interaction (`G-S1`, `G-S4`)

1. Adopt the renderer/projection decision after comparable RS-1/RS-2 evidence.
2. Build context-loss/recreate/disposal and camera-cutaway fixtures without
   treating the renderer projection as durable state.
3. Complete numeric alternatives, safe-area/keyboard/reduced-motion states
   and the real-device trace harness.
4. Collect participant and physical-device traces separately.

### Track D — catalog and control plane (`G-S6`, `G-CP-ADR`)

1. Obtain named Legal/Asset, Backend, Security and Operations owners.
2. Run the bounded control-plane ADR workflow; retain the no-Project-data
   perimeter.
3. Implement only catalog paths backed by exact bytes, provenance, pinning and
   `BackupFeasibilityPolicy`.
4. Attach real `AssetUsageGrant` dossiers, notices, backup/PNG corpus and an
   independent review.

### Track E — independent field evidence (`G-1` and later release gates)

1. Create consent/recruitment, moderator, observer, scoring and redaction
   materials through the appropriate research workflow.
2. Observe independent participants completing UJ-1…UJ-6 with real plans.
3. Record the named eight physical device/context rows with the mandated
   startup, offline, RS-2, context-loss and thermal sequences.

## Queued durability slice — writer fencing

**Actor:** a person opening the same local Project in a second browser/PWA
context.  
**Trigger:** the second context selects “Take over editing”.  
**Outcome:** it becomes the sole writer; the former context is visibly
read-only and its next publish is rejected without changing the last Durable
Revision.  
**Path:** AppShell → writer-access use case → fenced project-scoped repository
transaction → durable status and browser regression.

This slice deliberately excludes backups, blobs, catalog resources and
multi-project lifecycle. It remains queued until its own storage-policy inputs
and a source-owned fixture are adopted; the user’s overarching authorization
does not permit inventing those missing contracts.

# Reconciliation — `RoomGraph` → `AdjacencyGraph` (2026-08-04)

## Change signal

Normalize the PRD to the canonical `AdjacencyGraph` terminology without
changing the approved Door/Walk behavior. The update must not affect the
separate ItemInstance `lock/unlock` action in `FR-30`.

## Source extraction and outcome

| Source | Canonical finding | PRD outcome |
| --- | --- | --- |
| SPEC glossary | `AdjacencyGraph` is the derived graph of Room and `Walk edge`; it is not a separately persisted Door-state model. | Replaced the PRD glossary's non-canonical `RoomGraph` term. |
| SPEC CAP-4 and geometry contract | A valid Door on a Wall adjacent to exactly two derived Room creates one derived `Walk edge`; exterior, invalid, or non-two-Room Door creates neither edge nor transition. | `FR-17`, `FR-18` and `FR-20` now state the same positive and negative rule. |
| Architecture AD-6 | `AdjacencyGraph` is canonical and records `RoomGraph` in the PRD as a pending upstream editorial correction; no implementation alias may exist. | The PRD correction resolves that recorded terminology mismatch without changing Architecture. |
| Project context | Valid inter-room Door gives a derived walkable adjacency edge, not a lock/access/open-close model. | The resolved decision and `A-9` now use the canonical graph/edge terms. |
| Existing PRD/memlog Door decision | Valid inter-room Door is always passable; exterior/invalid Door does not transition; Door access/key/lock/open-close behavior is outside Alpha. | Behavior is retained exactly; only naming and cardinality precision changed. |

## Result

- `RoomGraph` is removed from `prd.md`.
- `AdjacencyGraph` and derived `Walk edge` are used in the glossary, §5.3,
  `FR-17`, `FR-18`, `FR-20`, `NFR-4`, the resolved decision and `A-9`.
- `FR-30` continues to allow `lock/unlock` for an **ItemInstance**; that action
  is unrelated to, and does not create, a Door state.

## Ownership boundary

Only PRD-owned wording and its append-only audit trail are changed. No UX,
SPEC, Architecture, Epics, roadmap, code or readiness artifact is edited or
claimed complete by this update.

Reader662 manager v2 — narrow orphan-monitor race fix

New external manager/test paths only; frozen53-member v1 packet and old manager/launcher unchanged. No app/driver/Native edits or execution.

Observed race: initial running record can be followed by final persistence and launcher EXIT before process scan. Old predicate then falsely marks INVALID. New confirm_unfinished_call rereads SAME record, requires running/same launcherPID/same SHA-bound campaign, refreshes exact PID/command ownership, then rereads once more after that process observation. A completed record or living current launcher cannot become an orphan. Genuine still-running/dead-launcher record continues to halt.

Evidence: exact old-predicate reproduction fails2 named assertions; final10 Python controls pass (all old8 retained plus2 race/owner vectors). Actual prepare-only against qualified13 again passed681-key closure and pinned662 variants; no stockdryrun/whole/Native. Final profile verification also passes. No score.

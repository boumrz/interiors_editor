External F/K v5 only; old35-member v4, q19 and all963 app/proof inputs remain unchanged.

V5 atomically persists actual spawned PID/PGID/Node program/CWD/profile/command before awaiting completion. A raw close event remains close-event-observed; only helper genuine closed/no pipeAbandonment can become closed. All record saves are atomic. Failed spawn-observer persistence still waits/drains the already-spawned real child.

Manager uses Reader-v2 race-safe sameowner/profile reread→freshPID/command→finalreread to stop on abrupt launcher death. Detached child groups are independently revalidated by exact current command/PGID or Node program+unique cwd or owned profile alias; unknown groups are preserved. All current owned and unknown stock/detached groups are computed BEFORE restore; any such physical uncertainty vetoes manager Source writes.

47CPU controls pass. Actual SIGKILL launcher control proves detached group discovery/drain and Source preservation; stale-running→finalpersist races do not falsely halt. The controlled command is lifecycle-only, not a fake claim of Native or application coverage. Exact963/q19 Key176 prepare-only and final campaign verify pass, unchanged32→15/176/80/1. No Native and no whole accepted. Root must review and explicitly lease future whole.

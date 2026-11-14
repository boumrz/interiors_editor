# Confirmed browser registered-ingress / legacy-export incompatibility

This is an integration blocker discovered after the functional GREEN handoff, not a passing backup-readiness claim.

An independent probe workspace is recorded in `browser-alias-probe-workspace.json`; it uses the frozen production files, a real static GLB, real SHA-256, actual runtime-v1 wire writer and actual registered decoder/smoke, the same fenced memory repository and unchanged default browser feasibility and legacy exporter.

The probe imports a valid wire Project whose exact resource hash spelling is uppercase. `importRegisteredPortableBackup` returns Durable; bytes are pinned only under that original uppercase key. A subsequent unchanged `exportPortableBackup` returns `{kind:'rejected', reasonCode:'PORTABLE_BACKUP_RESOURCES_UNAVAILABLE'}`. Logs: `browser-alias-probe.log` and `browser-alias-probe-exact.log`.

The existing legacy exporter restricts definition hashes to lowercase and compares the returned SHA-256 string literally in `readVerifiedResources`. The older legacy envelope grammar also has lowercase spelling/path assumptions; changing only the comparison would not prove a valid portable roundtrip. No Project key normalization, fallback decoder, host feasibility override or legacy-format extension was added to hide this result.

The parent owns source reconciliation and the browser admission/export pipeline resolution. Original checkout and the frozen implementation were not edited by this probe. The new route's ordinary unit GREEN and mutation threshold pass are not sufficient to waive the Portable Backup invariant exposed here.

# Owned child synchronous stop admission

External-only proposal; no app, live Common controller or frozen Factory artifact is edited. Owner artifact `/tmp/interiors-owned-child-stopguard-20261107-tr72qw9i`. Old shared helper SHA `43b11317d9643e20259973143a40995dfff8d05304fb6e3cf296427791064a69`; proposed helper SHA `311e81d1975e717650ff2dbee4d1d392dce8ee507c168a3b11c5c94c26ec1bf8`.

The Factory mathematical stop exposed an asynchronous admission race: `runOwnedChild` rejected before spawn, then the caller inspected PID/metadata before awaiting that promise. The abandoned rejection interrupted final asynchronous bookkeeping. Source and cache had already restored, but the producer terminal JSON remained stale.

The small helper change performs stop admission synchronously before creating a pending promise. It immediately observes any later pending rejection, while returning the original promise so its caller's await still rejects with the original error. Normal spawn, EXIT/CLOSE, ownership and drain code is unchanged. The caller diffs additionally observe pending immediately and await it on missing identity before raising a technical failure, preserving real terminal/error evidence.

Six real CPU controls pass in `stop-GREEN-final.log`: pre-stopped admission starts no child, a normal actual Node child closes/drains, sticky stop prevents another child, final asynchronous bookkeeping completes, delayed original await still rejects without unhandled events, and the actual default fatal-unhandled policy completes final bookkeeping. `real-default-policy-RED.log` reproduces the old helper failure in a separate copy; `stop-RED.log` retains the original test-first failures. No Native executes.

`helper-upgrade.diff`, `common-caller.diff` and `factory-caller.diff` are concrete adoption patches. The two `.proposed.mjs` copies pass Node syntax checks and are review artifacts, not running controllers. Root can adopt into new external clones and freeze fresh profiles; prior live/frozen artifacts stay untouched. The original helper name may remain `owned-child-v9.mjs` in the successor if the new bytes/SHA are explicitly frozen.

Replay:

```sh
/Users/romanzheltov/.npm/_npx/09ae5d3560c7b1f2/node_modules/node/bin/node --test /tmp/interiors-owned-child-stopguard-20261107-tr72qw9i/stop-admission.test.mjs
```

The archive and per-member index preserve all proposal code and evidence independently of `/tmp`.

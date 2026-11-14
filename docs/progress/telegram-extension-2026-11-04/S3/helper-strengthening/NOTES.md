# Helper test strengthening only

One existing test file changes from ff36; production helper remains exact SHA38710f. Added the missing right-extra own-property direction, equal-sized duplicate resource snapshot defense, and native Buffer-oracle UTF16 edges (minimum pair and high surrogate followed by non-low U+E000/U+FFFF). No policy, format, limits or accepted-value change.

Meaningful manual RED logs preserved, then complete unit suite178/2707/0skip GREEN; application/domain typecheck and owned lint pass (one pre-existing info). Focused equality/resource guards8/8 killed. Whole UTF8 scope v1 raw75Killed+3Timeout+2Survived; real survivor33 drove extra vectors. Whole UTF8 scope v2 raw76Killed+3Timeout+1Survived (98.75 detected). Remaining44 removes `current===undefined` guard inside for-of over string characters: every iterated string is nonempty, so native codePointAt(0) is defined. This is a narrow unreachable native-string case, not a blanket disposition. All80 IDs have independent per-worker activation observations with zero mismatch. Full623 helper baseline run uses prior ff36 and is retained separately; no replacement or inflated aggregate score is claimed.

Both killed and genuine infinite-loop timeouts are stated separately. No production edits, original checkout changes, dependency/manifest/lock changes or commits.

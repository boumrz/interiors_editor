# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-atomicity-e2e.check.ts >> TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together
- Location: tests/browser/telegram-atomicity-e2e.check.ts:5:1

# Error details

```
Error: page.evaluate: TypeError: Cannot read properties of undefined (reading 'resourceHashes')
    at Object.writePrepared (http://127.0.0.1:64003/main-11.js:1159:41)
    at eval (eval at evaluate (:311:30), <anonymous>:1:39)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
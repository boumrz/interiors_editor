# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-atomicity-e2e.check.ts >> TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together
- Location: tests/browser/telegram-atomicity-e2e.check.ts:5:1

# Error details

```
Error: page.evaluate: DataError: Failed to execute 'put' on 'IDBObjectStore': Evaluating the object store's key path did not yield a value.
    at TelegramScopeStore.reserveUnderLock (http://127.0.0.1:64335/main-0.js:3819:27)
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
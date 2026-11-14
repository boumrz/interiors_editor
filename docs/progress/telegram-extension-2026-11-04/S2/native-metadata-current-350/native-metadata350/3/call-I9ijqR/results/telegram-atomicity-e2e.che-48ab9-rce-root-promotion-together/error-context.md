# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-atomicity-e2e.check.ts >> TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together
- Location: tests/browser/telegram-atomicity-e2e.check.ts:5:1

# Error details

```
Error: page.evaluate: NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.
    at IDBDatabase.transaction (http://127.0.0.1:62429/main-11.js:284:43)
    at IDBDatabase.transaction (http://127.0.0.1:62429/main-11.js:26:43)
    at http://127.0.0.1:62429/main-11.js:819:36
    at new Promise (<anonymous>)
    at Object.storedRows [as rows] (http://127.0.0.1:62429/main-11.js:818:22)
    at async <anonymous>:337:30
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
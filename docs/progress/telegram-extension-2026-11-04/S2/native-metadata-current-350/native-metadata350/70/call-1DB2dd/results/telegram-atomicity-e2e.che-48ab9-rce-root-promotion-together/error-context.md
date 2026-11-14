# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-atomicity-e2e.check.ts >> TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together
- Location: tests/browser/telegram-atomicity-e2e.check.ts:5:1

# Error details

```
Error: page.evaluate: TypeError: Failed to execute 'request' on 'LockManager': Failed to read the 'mode' property from 'LockOptions': The provided value '' is not a valid enum value of type LockMode.
    at http://127.0.0.1:59594/main-0.js:3758:110
    at http://127.0.0.1:59594/main-4.js:195:20
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
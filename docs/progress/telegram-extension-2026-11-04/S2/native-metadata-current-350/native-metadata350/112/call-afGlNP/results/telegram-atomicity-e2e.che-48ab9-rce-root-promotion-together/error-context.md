# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-atomicity-e2e.check.ts >> TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together
- Location: tests/browser/telegram-atomicity-e2e.check.ts:5:1

# Error details

```
Error: page.evaluate: Error: Exact pin lease is missing
    at TelegramProjectRepository.requirePreparedLease (http://127.0.0.1:49187/main-0.js:2657:29)
    at async http://127.0.0.1:49187/main-0.js:2767:44
    at async scopedTransaction (http://127.0.0.1:49187/main-0.js:4065:32)
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
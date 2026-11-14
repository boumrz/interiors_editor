# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-storage-e2e.check.ts >> TMA-STORAGE-02: unsupported or queued/revoked lock never opens storage
- Location: tests/browser/telegram-storage-e2e.check.ts:369:1

# Error details

```
Error: page.evaluate: TypeError: Cannot read properties of undefined (reading 'catch')
    at TelegramScopeStore.close (http://127.0.0.1:53012/main-0.js:3738:52)
    at async Object.close (http://127.0.0.1:53012/main-11.js:648:9)
    at async <anonymous>:337:30
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
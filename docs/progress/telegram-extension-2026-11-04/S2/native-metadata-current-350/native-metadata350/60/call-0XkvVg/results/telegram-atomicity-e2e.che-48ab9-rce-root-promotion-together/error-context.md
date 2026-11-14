# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-atomicity-e2e.check.ts >> TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together
- Location: tests/browser/telegram-atomicity-e2e.check.ts:5:1

# Error details

```
Error: page.evaluate: Error: Telegram storage requires secure Web Locks
    at TelegramScopeStore.exclusively (http://127.0.0.1:59136/main-0.js:3755:43)
    at TelegramScopeStore.run (http://127.0.0.1:59136/main-0.js:3643:25)
    at TelegramProjectRepository.beginPins (http://127.0.0.1:59136/main-0.js:2638:29)
    at async Object.prepareResource (http://127.0.0.1:59136/main-11.js:1092:23)
    at async <anonymous>:337:30
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
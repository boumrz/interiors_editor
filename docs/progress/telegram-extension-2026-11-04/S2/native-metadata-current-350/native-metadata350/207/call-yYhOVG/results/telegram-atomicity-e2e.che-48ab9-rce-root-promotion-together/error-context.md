# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-atomicity-e2e.check.ts >> TMA-ATOMIC-01: pointer abort rolls back the published receipt and resource-root promotion together
- Location: tests/browser/telegram-atomicity-e2e.check.ts:5:1

# Error details

```
Error: page.evaluate: InvalidAccessError: Failed to execute 'transaction' on 'IDBDatabase': The storeNames parameter was empty.
    at IDBDatabase.transaction (http://127.0.0.1:51960/main-11.js:284:43)
    at IDBDatabase.transaction (http://127.0.0.1:51960/main-11.js:26:43)
    at scopedTransaction (http://127.0.0.1:51960/main-0.js:4047:38)
    at Object.transact (http://127.0.0.1:51960/main-0.js:3703:54)
    at TelegramProjectRepository.verifiedCurrentUnderLock (http://127.0.0.1:51960/main-0.js:2989:36)
    at TelegramProjectRepository.acquireUnderLock (http://127.0.0.1:51960/main-0.js:2436:36)
    at http://127.0.0.1:51960/main-0.js:2639:39
    at http://127.0.0.1:51960/main-0.js:3684:50
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
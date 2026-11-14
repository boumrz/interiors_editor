# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: telegram-readonly-source-e2e.check.ts >> TMA-READONLY-01: a genuine published Project is listed and exported with exact current bytes using only readonly native transactions
- Location: tests/browser/telegram-readonly-source-e2e.check.ts:12:1

# Error details

```
Error: page.evaluate: Error: Existing readonly snapshot is not connected
    at empty (http://127.0.0.1:53037/readonly.cc5466477945559f.js:5164:15)
    at async http://127.0.0.1:53037/readonly.cc5466477945559f.js:5180:17
```

# Page snapshot

```yaml
- main [ref=e2]: Native IndexedDB readonly source proof.
```
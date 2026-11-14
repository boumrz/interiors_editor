# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 00-scoped-resource-cas-e2e.check.ts >> SCOPED-CAS-register-library-version: exact stored metadata must still match after actual Blob verification
- Location: tests/browser/00-scoped-resource-cas-e2e.check.ts:5:2

# Error details

```
Error: page.evaluate: Error: Verified library resource changed
    at http://127.0.0.1:59196/main-src_adapters_persistence_scoped-project-repository_ts-d74dab55.js:1234:939
    at async scopedTransaction (http://127.0.0.1:59196/main-0.js:2705:24)
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Native storage test harness
```
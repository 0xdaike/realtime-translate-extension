# Contributing

Thanks for helping improve Personal Realtime Interpreter.

## Local Setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

Load the generated `dist/` directory from `chrome://extensions` with Developer mode enabled.

## Security And Privacy Rules

Never commit, paste, screenshot, or upload:

- Real OpenAI or Soniox API keys.
- Temporary API keys, client secrets, managed session tokens, or bearer tokens.
- Meeting names, participant names, private transcripts, or customer data.
- Browser profile data, logs, HAR files, `.env` files, or screenshots containing account details.

Use obvious dummy values in tests and docs. Prefer constructing fake provider keys from parts in tests when the exact prefix matters for redaction coverage.

## Recommended Secret Checks

Use official installed scanner binaries when available:

```bash
gitleaks detect --source . --redact
trufflehog git file://. --only-verified
```

If those tools are not installed, at minimum inspect the Git history for common secret patterns before opening a pull request.

## Pull Request Checklist

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Update `docs/MANUAL_QA.md` if behavior changes.
- Update `SECURITY.md` if storage, permissions, messaging, CSP, or provider credential flow changes.
- Confirm no real API key, transcript, meeting content, or private screenshot is included.

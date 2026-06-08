# Personal Realtime Interpreter

Personal Realtime Interpreter is a free BYOK Chrome extension for translating browser meeting and video audio in real time with selectable providers.

Current providers:

- OpenAI Realtime: translated audio and subtitles.
- Soniox: lower-cost translated subtitles. Voice output through Soniox TTS is planned as a later beta, not part of this first Soniox implementation.

Service modes:

- BYOK: users provide their own OpenAI or Soniox API key.
- Managed: a future paid-service mode where the extension requests a short-lived realtime session from your own API. This mode is disabled unless the build sets an HTTPS `VITE_MANAGED_SESSION_URL` and the release manifest includes that exact backend origin.

The initial implementation target is a Chrome Manifest V3 extension built with Vite, React, and TypeScript.

## Project Status

This repository is public open source under the MIT License. The current release is `v0.1.0`, an MVP for local Chrome extension builds and manual QA.

This project is not intended to be published as an npm package. `package.json` keeps `"private": true` as a guard against accidental package publication; distribution is expected through built Chrome extension artifacts.

## Why This Matters

Realtime translation can make browser meetings, online classes, videos, webinars, and livestreams more accessible across languages. This project focuses on a privacy-minded BYOK model where users keep control of provider accounts and the extension avoids storing audio or transcript content.

## Maintainer

This project is maintained by `0xdaike`. Current planning is tracked in [TASKS.md](./TASKS.md) and public GitHub issues.

## Important Warnings

- Bring your own OpenAI or Soniox API key. API usage is billed to your own provider account.
- Browser-side API key handling cannot be made as safe as a backend service.
- Do not use this extension for confidential meetings unless your organization and meeting participants allow it.
- This project does not add a backend, subscription, Stripe, user authentication, analytics, telemetry, audio storage, transcript storage, or meeting-content storage.

## Security Goals

- Keep standard provider API keys in trusted extension contexts only.
- Never expose standard provider API keys to the content script or page DOM.
- Pass only short-lived OpenAI client secrets or Soniox temporary keys to the offscreen document.
- Store no audio or transcript content.
- Default to `session_only` key handling.

See [SECURITY.md](./SECURITY.md) for the full security design.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

The build output is written to `dist/`. Load that directory from `chrome://extensions` with "Load unpacked" after a successful build.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening changes that include screenshots, provider credentials, logs, or QA evidence.

## Usage

1. Build the extension.
2. Load `dist/` from `chrome://extensions`.
3. Open Options, choose the translation engine, and add the matching provider API key.
4. Open a browser meeting or video tab.
5. Click the extension popup, choose a target language, adjust volumes, and start translation.
6. Stop translation from the popup when finished.

Supported initial targets are browser audio tabs such as YouTube, Google Meet, Microsoft Teams Web, Zoom Web, online courses, webinars, and livestreams. Desktop app audio, microphone translation, recording, speaker diarization, and returning translated audio back into a meeting are out of scope for the MVP.

## Privacy And Security

- Audio is sent directly from the extension to the selected provider.
- No developer server is used.
- Audio and transcript content are not stored by this extension.
- Standard provider API keys are kept in trusted extension contexts and are not sent to the content script or page DOM.
- The offscreen document receives only a short-lived OpenAI Realtime client secret or Soniox temporary key.
- Managed mode does not store provider API keys in the extension; it receives only a short-lived managed session token from your API.
- Managed session responses must include a WSS `session_url`, a `session_token`, and a near-future `expires_at`. The extension waits for a managed WebSocket `ready` / `session.ready` event before sending tab audio.
- If your managed realtime WebSocket uses a different origin from `VITE_MANAGED_SESSION_URL`, set `VITE_MANAGED_REALTIME_ORIGIN` to the exact `wss://...` origin and add matching release CSP/permissions.
- Browser-side BYOK is still less safe than a backend service. Do not use this for confidential meetings unless your organization and meeting participants allow it.

## Troubleshooting

- If the popup cannot start, confirm an API key is available or unlocked in Options.
- If tab audio capture fails, activate the target tab and start from the popup again.
- In OpenAI audio mode, if translated audio does not play, interact with the page and retry because browsers can block autoplay. Soniox currently provides translated subtitles only.
- If the connection fails, check the selected provider account billing, model/API access, and current realtime availability.
- For end-to-end checks, follow [docs/MANUAL_QA.md](./docs/MANUAL_QA.md).

## Current Scope

The MVP scope is tracked in [TASKS.md](./TASKS.md). The product and architecture specification is in [SPEC.md](./SPEC.md).

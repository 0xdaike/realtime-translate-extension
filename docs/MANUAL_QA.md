# Manual QA

Use this checklist after `npm run build`. Do not paste real API keys into logs, screenshots, issues, or pull requests.

## Evidence Handling

Allowed QA evidence:

- Extension status text.
- Provider name and target language.
- Browser/version and OS/version.
- Redacted errors.
- Screenshots with no API keys, account identifiers, meeting names, participants, or private transcript text.

Do not attach:

- Real API keys or temporary credentials.
- Console output containing `Authorization`, `client_secret`, `session_token`, `api_key`, or transcript content.
- Meeting recordings, participant names, customer names, private subtitles, or browser profile data.

## Build And Load

1. Run `npm install` if dependencies are not installed.
2. Run `npm run typecheck`.
3. Run `npm test`.
4. Run `npm run build`.
5. Open `chrome://extensions`.
6. Enable Developer mode.
7. Click "Load unpacked" and select the `dist/` directory.

## API Key Setup

1. Open the extension Options page.
2. Confirm the default mode is `session_only`.
3. For Soniox-only QA, switch the translation engine to `Soniox` and save a Soniox API key.
4. Close and reopen the popup.
5. Confirm the popup shows that the Soniox key is available.
6. Optional: if an OpenAI key is available later, switch the translation engine to OpenAI and confirm key availability is tracked separately.
7. Optional: switch to `encrypted_local`, save with a passphrase, lock, unlock, and delete the key.

## Browser Audio Scenario Matrix

| Scenario | Provider | Expected result | Notes |
|---|---|---|---|
| YouTube video | Soniox | Translated subtitles appear; no translated voice is expected | Current lowest-cost real QA path |
| YouTube video | OpenAI | Translated subtitles and translated audio appear | Requires funded OpenAI Realtime access |
| Google Meet web | Soniox | Captured meeting audio produces translated subtitles | Run only with allowed test meetings |
| Microsoft Teams Web | Soniox | Captured meeting audio produces translated subtitles | Run only with allowed test meetings |
| Zoom Web | Soniox | Captured meeting audio produces translated subtitles | Run only with allowed test meetings |
| Online course/webinar/livestream | Soniox | Speaker audio produces translated subtitles | Use public or owned test content |
| Tab close during session | Any connected provider | Session stops, overlay is removed, capture ends | No stale active session should remain |
| Extension reload during idle state | Any configured provider | No active session is restored unexpectedly | Confirm key state remains expected |
| Provider error response | Any provider | Error is actionable and redacted | No API key, temporary key, token, or transcript in message |

Record pass/fail per scenario, browser version, provider, and target language. Do not record private transcript text.

## Managed Mode Smoke Test

1. Build with `VITE_MANAGED_SESSION_URL` set to the HTTPS developer API session endpoint.
2. Confirm the release manifest includes only that exact managed API origin, not a wildcard.
3. If the realtime WebSocket uses a different origin, set `VITE_MANAGED_REALTIME_ORIGIN` to the exact `wss://...` origin and confirm release CSP allows only that origin.
4. Open Options and select `Managed`.
5. Confirm the API key setup panel is hidden and the Managed Plan panel is shown.
6. Open the popup and confirm it says personal API keys are not required.
7. Confirm Popup start is disabled if the build has no managed API URL or exact managed host permission.
8. Start translation and confirm Background requests a managed session before creating the offscreen session.
9. Confirm the managed response includes `session_url`, `session_token`, and near-future `expires_at`.
10. Confirm the offscreen document receives only the managed short-lived session URL/token, not provider standard API keys.
11. Confirm audio is not streamed until the managed WebSocket sends `ready` or `session.ready`.
12. Confirm a build without `VITE_MANAGED_SESSION_URL` disables starting Managed sessions.

## OpenAI Realtime Smoke Test

1. Open a YouTube video with audible speech.
2. Click the extension icon.
3. Select `OpenAI` and choose a target language.
4. Keep subtitles enabled.
5. Click start.
6. Confirm status moves through preparing/capturing/connecting/connected.
7. Confirm translated audio plays locally.
8. Confirm translated subtitles appear in the bottom-center overlay.
9. Move original and translated volume sliders while connected.
10. Confirm the usage timer increments.
11. Click stop and confirm overlay/audio cleanup.

## Soniox Subtitle Smoke Test

1. Open a YouTube video with audible speech.
2. Click the extension icon and select `Soniox`.
3. Select a target language.
4. Confirm subtitle display is enabled; Soniox mode is subtitle-only in this implementation.
5. Click start.
6. Confirm status moves through preparing/capturing/connecting/connected.
7. Confirm translated subtitles appear in the overlay.
8. Confirm no translated voice is expected in this first Soniox mode.
9. Click stop and confirm overlay/audio cleanup.

## Soniox-Only QA Scope

Use this path when OpenAI API access is unavailable.

Required checks:

1. Build and load `dist/`.
2. Save only a Soniox API key.
3. Confirm the popup can start with provider `Soniox`.
4. Confirm translated subtitles appear.
5. Confirm source transcript display can be toggled.
6. Confirm original audio volume can be adjusted.
7. Confirm translated voice output is not expected for Soniox in the current implementation.
8. Confirm stop removes the overlay and stops tab capture.
9. Confirm closing the captured tab stops the session.
10. Confirm no real API key appears in screenshots, logs, `dist/`, or issue text.

Not required for Soniox-only QA:

1. OpenAI client secret creation.
2. OpenAI translated audio playback.
3. OpenAI cost accuracy.
4. Managed paid-service backend flow.

## Meeting Smoke Tests

Repeat the YouTube flow on:

- Google Meet
- Microsoft Teams Web
- Zoom Web

Only run this with meetings where translation by the selected provider is allowed by all applicable policies and participants.

## Cleanup Checks

1. Start translation.
2. Close the captured tab.
3. Confirm the extension returns to stopped state.
4. Confirm translated audio stops.
5. Confirm no overlay remains on other pages.
6. Reload the extension from `chrome://extensions` and confirm no active session persists.

## Security Checks

1. Confirm `dist/manifest.json` has no `<all_urls>`, `tabs`, `cookies`, `history`, `webRequest`, `debugger`, or `unlimitedStorage`.
2. Confirm the content script receives only overlay/status/transcript messages.
3. Confirm the content script bundle has no top-level `import` or `export`.
4. Confirm transcript rendering uses `textContent`, not `innerHTML`.
5. Confirm no audio or transcript text is saved in `chrome.storage.local`.
6. Confirm the standard provider API key is never sent to the offscreen document or content script.
7. Confirm OpenAI offscreen sessions receive only a short-lived client secret.
8. Confirm Soniox offscreen sessions receive only a short-lived temporary key.
9. Confirm Managed offscreen sessions receive only a short-lived managed session token.
10. Search `dist/` for real API keys before sharing a build.
11. If installed, run `gitleaks detect --source . --redact` or `trufflehog git file://. --only-verified` before publishing release evidence.

## Troubleshooting

- If tab capture fails, click the target tab first and start from the popup while that tab is active.
- If translated audio does not autoplay, interact with the page and start again.
- If the key is locked, unlock it from Options or use `session_only` again.
- If Realtime connection fails, verify the selected provider account access, billing, and current realtime API availability.
- During an active session, lock/delete the selected provider key from Options and confirm the popup can still stop the running session.

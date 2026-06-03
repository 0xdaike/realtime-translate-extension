# TASKS.md
# Codex Implementation Tasks

作成日: 2026-05-12 JST  
対象: Personal Realtime Interpreter / 無料BYOK Chrome拡張  
目的: Codexが順番に実装できる粒度でタスクを分解する。

---

## 0. Ground Rules for Codex

Before implementing:

- Do not add a backend.
- Do not add Stripe.
- Do not add auth.
- Do not add analytics.
- Do not add telemetry.
- Do not store audio.
- Do not store transcripts.
- Do not expose standard provider API keys to Content Script.
- Do not expose standard provider API keys to Offscreen Document.
- Managed mode must use HTTPS developer API session endpoints and short-lived sessions only.
- Managed realtime WebSocket must use an allowed WSS origin and must send `ready` / `session.ready` before the extension streams tab audio.
- Do not log secrets.
- Keep dependencies minimal.
- Use TypeScript strict mode.
- Prefer explicit types over `any`.

---

## Phase 1: Project Scaffold

### T001 - Create Vite + React + TypeScript project

Acceptance:

- `npm install` works.
- `npm run build` works.
- `npm run typecheck` works.
- Source files are under `src/`.

### T002 - Add Chrome Manifest V3 build support

Implement:

- Manifest generation or static manifest.
- Output to `dist/`.
- Popup page.
- Options page.
- Offscreen HTML.
- Background service worker.

Acceptance:

- `dist/manifest.json` exists.
- Manifest version is 3.
- Background is module service worker.
- Popup and options pages load.

### T003 - Add recommended permissions

Manifest permissions:

```json
[
  "storage",
  "activeTab",
  "scripting",
  "tabCapture",
  "offscreen"
]
```

Host permissions:

```json
[
  "https://api.openai.com/*",
  "https://api.soniox.com/*",
  "https://stt-rt.soniox.com/*"
]
```

Acceptance:

- No `<all_urls>`.
- No `tabs` permission unless explicitly justified.
- No `webRequest`, `cookies`, `history`, or `debugger`.

### T004 - Create documentation files

Add:

- `README.md`
- `SPEC.md`
- `SECURITY.md`
- `TASKS.md`

Acceptance:

- README includes BYOK warning.
- README includes no-backend/no-telemetry statement.
- SECURITY includes key handling rules.

---

## Phase 2: Shared Types and Constants

### T005 - Define language constants

Create:

```text
src/lib/constants/languages.ts
```

Implement:

- `TARGET_LANGUAGES`
- `TargetLanguage`
- `isTargetLanguage(value)`

Acceptance:

- Supports: `ja,en,zh,ko,es,pt,fr,de,ru,hi,id,vi,it`.
- Default is `ja`.

### T006 - Define OpenAI endpoints

Create:

```text
src/lib/constants/endpoints.ts
```

Implement:

```ts
export const OPENAI_TRANSLATION_CLIENT_SECRET_URL =
  "https://api.openai.com/v1/realtime/translations/client_secrets";

export const OPENAI_TRANSLATION_CALLS_URL =
  "https://api.openai.com/v1/realtime/translations/calls";
```

Acceptance:

- Endpoints used from constants only.

### T007 - Define message types

Create:

```text
src/lib/messaging/messageTypes.ts
src/types/messages.ts
```

Implement all messages from `SPEC.md`.

Acceptance:

- TypeScript discriminated union.
- No use of `any`.
- Includes transcript, status, start/stop, volume, overlay messages.

### T008 - Define error codes and messages

Create:

```text
src/lib/errors/errors.ts
src/lib/errors/userFacingMessages.ts
```

Acceptance:

- Includes all error codes from SPEC.
- Japanese user-facing messages.
- Redaction is applied before display/logging.

---

## Phase 3: Storage and Security Foundation

### T009 - Restrict storage access level

Create:

```text
src/security/trustedStorage.ts
```

Implement:

```ts
export async function initializeTrustedStorageAccess(): Promise<void>
```

It should call:

```ts
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
```

Acceptance:

- Called from service worker startup.
- Failure is handled gracefully but reported.

### T010 - Implement redaction utility

Create:

```text
src/security/redaction.ts
```

Acceptance:

- Redacts `sk-...`.
- Redacts ephemeral/client-secret-like tokens.
- Redacts `Bearer ...`.
- Unit tests pass.

### T011 - Implement session key store

Create:

```text
src/security/sessionKeyStore.ts
```

Responsibilities:

- Store API key in `chrome.storage.session`.
- Retrieve API key.
- Delete API key.
- Never use local/sync storage.

Acceptance:

- Browser restart/extension reload clears session key.
- Content Script cannot access session key due to trusted access level.

### T012 - Implement passphrase crypto

Create:

```text
src/security/passphraseCrypto.ts
```

Implement:

- PBKDF2-SHA256 key derivation.
- AES-GCM encryption.
- AES-GCM decryption.
- Base64 helpers.
- Random salt.
- Random IV.

Acceptance:

- Encrypt/decrypt round-trip works.
- Wrong passphrase throws.
- No passphrase persisted.
- No plaintext key persisted.

### T013 - Implement encrypted local key store

Create:

```text
src/security/encryptedLocalKeyStore.ts
```

Responsibilities:

- Encrypt and store API key.
- Store only encrypted record.
- Unlock to session storage or in-memory cache.
- Delete encrypted key.
- Return key hint only.

Acceptance:

- Plaintext API key is not present in `chrome.storage.local`.
- Saved record includes version, kdf, iterations, salt, iv, ciphertext, keyHint.
- Delete removes encrypted record and session key.

### T014 - Implement KeyVault

Create:

```text
src/security/keyVault.ts
```

Responsibilities:

- Handle `session_only`.
- Handle `encrypted_local`.
- Prepare future `local_broker` placeholder.
- Expose `hasKey`, `unlock`, `lock`, `deleteKey`, `getApiKeyForTrustedContext`.

Acceptance:

- `getApiKeyForTrustedContext` only used by background modules.
- Throws `API_KEY_MISSING` or `API_KEY_LOCKED` when needed.
- Does not leak API key in errors.

---

## Phase 4: Options UI

### T015 - Create Options page shell

Create:

```text
src/options/index.html
src/options/OptionsApp.tsx
```

Acceptance:

- Options page renders.
- Uses Japanese UI.
- Shows security warning.

### T016 - Implement SecurityModeSelect

Create:

```text
src/options/components/SecurityModeSelect.tsx
```

Acceptance:

- Modes: `session_only`, `encrypted_local`.
- `local_broker` shown as "将来対応" or hidden.
- Changing mode explains risk/behavior.

### T017 - Implement ApiKeySetup

Create:

```text
src/options/components/ApiKeySetup.tsx
```

Features:

- Password input for API key.
- Passphrase fields for encrypted mode.
- Save button.
- Unlock button.
- Lock button.
- Delete button.
- Masked key hint display.

Acceptance:

- API key value is not displayed after save.
- API key is not logged.
- Delete clears all key material.
- Wrong passphrase shows Japanese error.

### T018 - Implement DefaultSettingsForm

Create:

```text
src/options/components/DefaultSettingsForm.tsx
```

Settings:

- Default target language.
- Subtitle default.
- Show source transcript.
- Original volume.
- Translation volume.
- Mute original on start.

Acceptance:

- Settings persist in `chrome.storage.local`.
- No secrets are stored through this form.

### T019 - Implement PrivacyNotice

Create:

```text
src/options/components/PrivacyNotice.tsx
```

Acceptance:

- Clearly states audio goes to OpenAI.
- States developer server is not used.
- States audio/transcripts are not stored.
- States selected provider API usage cost belongs to user.
- Warns about confidential meetings.

---

## Phase 5: Popup UI

### T020 - Create Popup page shell

Create:

```text
src/popup/index.html
src/popup/PopupApp.tsx
```

Acceptance:

- Popup renders.
- Shows session status.
- Shows key status.
- Shows default language.

### T021 - Implement StartStopButton

Acceptance:

- Start sends `POPUP_START_TRANSLATION`.
- Stop sends `POPUP_STOP_TRANSLATION`.
- Button disabled when key missing/locked.
- Shows loading state.

### T022 - Implement LanguageSelect

Acceptance:

- Uses `TARGET_LANGUAGES`.
- Defaults to saved setting.
- Validates target language.

### T023 - Implement VolumeControls

Acceptance:

- Original volume slider 0-1.
- Translation volume slider 0-1.
- Mute original checkbox.
- Sends volume update during active session.

### T024 - Implement StatusPanel

Acceptance:

- Shows idle/preparing/capturing/connecting/connected/error.
- User-facing error messages in Japanese.
- Error payloads redacted.

### T025 - Implement UsagePanel

Acceptance:

- Shows current session seconds.
- Shows today/month usage.
- Shows estimated OpenAI cost.
- Notes that estimate is local only.

---

## Phase 6: Background Service Worker

### T026 - Create service worker entry

Create:

```text
src/background/serviceWorker.ts
```

Responsibilities:

- Initialize trusted storage access.
- Register message router.
- Register tab close listener.
- Maintain current session state.

Acceptance:

- Loads without errors.
- Does not directly implement all logic; delegates to controllers.

### T027 - Implement message router

Create:

```text
src/background/messageRouter.ts
```

Acceptance:

- Routes popup start/stop.
- Routes offscreen status.
- Routes transcript delta.
- Routes volume updates.
- Validates message types.

### T028 - Implement session state

Create:

```text
src/lib/state/sessionState.ts
```

Acceptance:

- Tracks idle/preparing/capturing/connecting/connected/stopping/error.
- Tracks active tab ID.
- Tracks session start timestamp.
- Prevents two active sessions.

### T029 - Implement tab capture controller

Create:

```text
src/background/tabCaptureController.ts
```

Responsibilities:

- Get active tab.
- Call `chrome.tabCapture.getMediaStreamId`.
- Return stream ID.

Acceptance:

- User must start from active tab.
- Handles failure as `TAB_CAPTURE_FAILED`.
- Does not capture without user action.

### T030 - Implement offscreen controller

Create:

```text
src/background/offscreenController.ts
```

Responsibilities:

- Check if offscreen document exists.
- Create offscreen document.
- Send start/stop messages.
- Close offscreen when no session.

Acceptance:

- Creates one offscreen document only.
- Handles repeated starts/stops.

### T031 - Implement OpenAI client secret service

Create:

```text
src/background/openaiClientSecretService.ts
```

Responsibilities:

- Retrieve API key via KeyVault.
- Validate target language.
- POST to client secret endpoint.
- Return client secret.

Acceptance:

- API key never returned to caller.
- API key never logged.
- Non-2xx OpenAI response handled.
- Response schema validated defensively.

### T032 - Implement session controller

Create:

```text
src/background/sessionController.ts
```

Start sequence:

1. Validate no session running.
2. Validate key available/unlocked.
3. Inject content script.
4. Initialize overlay.
5. Create offscreen document.
6. Get tab capture stream ID.
7. Create client secret.
8. Send start to offscreen.
9. Start usage timer.

Stop sequence:

1. Send stop to offscreen.
2. Remove overlay.
3. Stop usage timer.
4. Reset state.

Acceptance:

- Cleanup runs even on error.
- Status propagated to popup/content.
- Session cannot double-start.

---

## Phase 7: Content Script Overlay

### T033 - Create content script entry

Create:

```text
src/content/overlay.ts
src/content/contentMessageHandler.ts
```

Acceptance:

- Injected on start.
- Handles overlay init/remove.
- Does not access storage.
- Does not perform network requests.

### T034 - Implement subtitle overlay

Create:

```text
src/content/subtitleOverlay.ts
src/content/overlayStyles.ts
```

Acceptance:

- Uses Shadow DOM.
- Renders with `textContent`, not `innerHTML`.
- Displays translated subtitle.
- Optionally displays source transcript.
- Has high z-index.
- Does not block page controls by default.
- Removes itself on stop.

### T035 - Implement transcript buffering

Acceptance:

- Deltas are appended smoothly.
- Final transcript starts a new line or segment.
- Keeps only last N lines.
- Does not persist transcript.

---

## Phase 8: Offscreen Document

### T036 - Create offscreen document

Create:

```text
src/offscreen/offscreen.html
src/offscreen/offscreen.ts
```

Acceptance:

- Receives `OFFSCREEN_START`.
- Receives `OFFSCREEN_STOP`.
- Sends status events.
- No direct UI.

### T037 - Implement tab audio stream resolution

Create:

```text
src/offscreen/tabAudioStream.ts
```

Responsibilities:

- Convert stream ID to MediaStream.
- Verify audio track exists.
- Throw `NO_AUDIO_TRACK` if absent.

Acceptance:

- Works with tabCapture stream ID.
- Stops tracks on failure.

### T038 - Implement audio graph

Create:

```text
src/offscreen/audioGraph.ts
```

Responsibilities:

- Play original tab audio locally.
- Apply original gain.
- Provide translated audio gain path if possible.
- Cleanup audio context.

Acceptance:

- Original audio can be muted.
- Original audio volume adjustable.
- Cleanup closes AudioContext.

### T039 - Implement translated audio player

Create:

```text
src/offscreen/translatedAudioPlayer.ts
```

Responsibilities:

- Create audio element for remote translated stream.
- Attach remote track.
- Apply volume.
- Handle autoplay failure.

Acceptance:

- Plays translated audio.
- Translation volume adjustable.
- Reports `AUTOPLAY_BLOCKED` if needed.

### T040 - Implement Realtime Translation peer

Create:

```text
src/offscreen/realtimeTranslationPeer.ts
```

Responsibilities:

- Create `RTCPeerConnection`.
- Add tab audio track.
- Create `oai-events` data channel.
- Create offer.
- POST offer to OpenAI calls endpoint using client secret.
- Set answer.
- Handle remote audio track.
- Forward data channel messages to parser.
- Close connection.

Acceptance:

- Connects to OpenAI with client secret.
- Does not use standard API key.
- Emits connected/error states.
- Closes cleanly.

### T041 - Implement transcript event parser

Create:

```text
src/offscreen/transcriptEventParser.ts
```

Responsibilities:

- Parse JSON data channel events.
- Extract translated transcript deltas.
- Extract source transcript deltas if enabled.
- Extract error events.

Acceptance:

- Unknown events are ignored or logged safely.
- Transcript text sent to background.
- No secret logged.

### T042 - Implement offscreen cleanup

Acceptance:

- Stop all media tracks.
- Close peer connection.
- Close data channel.
- Pause and remove audio element.
- Close AudioContext.
- Clear local references.
- Notify background stopped.

---

## Phase 9: Usage Estimation

### T043 - Implement local usage timer

Create:

```text
src/lib/usage/localUsageTimer.ts
src/background/usageController.ts
```

Acceptance:

- Timer starts when session connects or starts.
- Timer stops on cleanup.
- Records seconds locally.
- No URL/content stored by default.

### T044 - Implement cost estimator

Create:

```text
src/lib/usage/costEstimator.ts
```

Use:

```ts
const GPT_REALTIME_TRANSLATE_USD_PER_MIN = 0.034;
```

Acceptance:

- Calculates cost from seconds.
- Displays as estimate.
- Includes warning that OpenAI dashboard is source of truth.

---

## Phase 10: Error Handling and Resilience

### T045 - Add global error boundary for Popup/Options

Acceptance:

- UI does not crash silently.
- Shows Japanese error.
- No sensitive data shown.

### T046 - Add background error handling

Acceptance:

- All start errors trigger cleanup.
- State becomes error then idle after stop.
- Errors are redacted.

### T047 - Add offscreen error handling

Acceptance:

- WebRTC failure reported.
- Remote audio failure reported.
- Data channel errors reported.
- Cleanup on error.

### T048 - Add tab close handling

Acceptance:

- If active captured tab closes, stop session.
- Remove overlay.
- Stop usage timer.

### T049 - Add extension unload/reload cleanup

Acceptance:

- Best effort cleanup.
- No persistent active session state after reload.

---

## Phase 11: Tests

### T050 - Unit tests for redaction

Acceptance:

- Redacts API keys.
- Redacts Bearer tokens.
- Does not over-redact normal text.

### T051 - Unit tests for language validation

Acceptance:

- Accepts all supported language codes.
- Rejects unsupported language codes.

### T052 - Unit tests for cost estimator

Acceptance:

- 60 seconds = 0.034 USD.
- 0 seconds = 0.
- Formatting stable.

### T053 - Unit tests for passphrase crypto

Acceptance:

- Round-trip encrypt/decrypt.
- Wrong passphrase fails.
- Different IVs produce different ciphertexts.

### T054 - Manual QA script

Create:

```text
docs/MANUAL_QA.md
```

Include:

- Build steps.
- Load unpacked steps.
- API key setup steps.
- YouTube test.
- Google Meet test.
- Teams Web test.
- Zoom Web test.
- Cleanup test.
- Security verification checklist.

---

## Phase 12: Documentation

### T055 - README

Acceptance:

README includes:

- What this extension does.
- BYOK explanation.
- No backend/no telemetry statement.
- OpenAI/Soniox API cost warning.
- Security limitations.
- Installation instructions.
- Build instructions.
- Usage instructions.
- Supported/unsupported targets.
- Troubleshooting.

### T056 - Privacy notice

Acceptance:

- Add to README and Options.
- State audio is sent to OpenAI.
- State no developer server is used.
- State audio/transcripts are not stored.
- State user pays selected provider API costs.
- State confidential meetings require organization approval.

### T057 - Security docs

Acceptance:

- SECURITY.md included.
- API key handling clear.
- Residual risks clear.
- Local broker future option described.

---

## Phase 13: Hardening

### T058 - Remove debug logs

Acceptance:

- No logs containing secrets.
- Transcript logging disabled by default.
- Debug mode is opt-in and safe.

### T059 - Verify content script isolation

Acceptance:

- Content Script cannot read storage.
- Content Script does not receive key/client secret.
- Page DOM cannot access secrets.

### T060 - Verify built output

Acceptance:

- No API key in `dist/`.
- No `.env` bundled.
- No remote CDN scripts.
- No unnecessary permissions.

### T061 - Add basic CSP

Acceptance:

- Manifest/content security policy avoids unsafe remote scripts.
- No remote code execution.
- Build passes.

---

## Phase 14: Optional Future - Local Broker

### T062 - Design native messaging local broker

Not MVP.

Acceptance:

- Define native host protocol.
- Local broker reads `OPENAI_API_KEY`.
- Local broker creates client secret.
- Extension receives only client secret.

### T063 - Implement local broker

Not MVP.

Acceptance:

- Node/Rust/Go CLI.
- Native messaging manifest.
- Install instructions for macOS/Windows/Linux.

---

## Final MVP Acceptance Checklist

MVP is accepted when all are true:

- [ ] `npm run build` succeeds.
- [ ] `npm run typecheck` succeeds.
- [ ] Extension loads via `chrome://extensions` Load unpacked.
- [ ] Options page saves session-only API key.
- [ ] Options page saves encrypted local API key.
- [ ] Encrypted key can be unlocked and deleted.
- [ ] API key is not visible after save.
- [ ] Popup can start/stop session.
- [ ] YouTube tab translation works.
- [ ] Google Meet browser meeting translation works.
- [ ] Translated audio plays locally.
- [ ] Translated subtitles render via overlay.
- [ ] Original audio can be muted or adjusted.
- [ ] Translation volume can be adjusted.
- [ ] Stop cleans up peer connection, tracks, audio contexts, and overlay.
- [ ] API key is not passed to Content Script.
- [ ] API key is not passed to Offscreen Document.
- [ ] API key is not logged.
- [ ] Audio/transcript content is not stored.
- [ ] Local usage estimate is shown.
- [ ] User can clear all settings.
- [ ] README and SECURITY are complete.

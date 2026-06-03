# SECURITY.md
# Security Design for Personal Realtime Interpreter

## Current Provider Scope

The extension now supports two provider modes:

- OpenAI Realtime: the standard OpenAI API key stays in trusted extension contexts; Background creates a short-lived Realtime client secret; Offscreen receives only that client secret.
- Soniox: the standard Soniox API key stays in trusted extension contexts; Background creates a short-lived Soniox temporary key for `transcribe_websocket`; Offscreen receives only that temporary key.

It also has two service modes:

- BYOK: the user supplies and controls the provider API key.
- Managed: a future paid-service path where Background requests a short-lived realtime session from the developer-operated API. Managed mode must not persist provider API keys, refresh tokens, or billing credentials in the extension.
- Managed API calls require an HTTPS `VITE_MANAGED_SESSION_URL`. Returned realtime URLs must use WSS, must not include query/fragment token data, and must match the configured realtime origin.
- Managed session responses must include `expires_at`; the extension rejects expired or unexpectedly long-lived sessions.
- The managed offscreen peer sends the `session_token` as a WebSocket auth message and waits for `ready` / `session.ready` before streaming tab audio.

Content Script remains display-only. It receives subtitle/status messages only and must not receive provider API keys, client secrets, temporary keys, audio, encrypted key records, or passphrases.

Host permissions are intentionally limited to:

```json
[
  "https://api.openai.com/*",
  "https://api.soniox.com/*",
  "https://stt-rt.soniox.com/*"
]
```

When Managed mode is released, add only the exact managed API origin to `host_permissions` and the exact managed HTTPS/WSS endpoints to CSP. Do not add `<all_urls>` or broad wildcard origins.

作成日: 2026-05-12 JST  
対象: 無料・個人利用・BYOK型Chrome拡張  
重要: この設計はバックエンドなしでリスクを最小化する設計であり、APIキーをブラウザ環境で扱うリスクを完全には排除できない。

---

## 1. Security Position

OpenAI APIキーは本来、ブラウザやモバイルアプリなどのクライアントサイド環境に置くべきではない。  
この拡張は「ユーザー本人が自分のPCで、自分のAPIキーを使う」無料BYOKツールであるため、商用SaaSのような完全なキー保護はできない。

したがって、このプロジェクトのセキュリティ目標は次の通り。

```text
Goal:
  No backend BYOK extensionとして、APIキー露出・誤送信・不必要な保存を最小化する。

Not Goal:
  悪意あるローカル端末、マルウェア、悪意ある拡張アップデート、完全なリバースエンジニアリング耐性からAPIキーを完全に守ること。
```

---

## 2. Threat Model

### 2.1 Assets

守るべき資産:

- OpenAI or Soniox API key
- OpenAI Realtime client secret or Soniox temporary key
- Browser tab audio
- Meeting/video content
- Translated transcript
- User settings
- Local usage records

### 2.2 Trusted Contexts

Trusted:

- Background Service Worker
- Extension pages:
  - Popup
  - Options
  - Offscreen Document

Less trusted:

- Content Script

Untrusted:

- Host web page
- Page DOM
- Page JavaScript
- Third-party scripts in meetings/videos
- Other browser extensions
- Network attackers
- Malicious local software
- Accidentally committed source code

### 2.3 Main Threats

| Threat | Risk | Mitigation |
|---|---|---|
| API key exposed to page JS | High | Never inject key into DOM or Content Script |
| API key exposed to Content Script | High | Keep key in Background only |
| API key stored plaintext | High | Default session-only; optional encrypted local |
| API key committed to Git | High | Never use `.env` or source-embedded key |
| API key logged | High | Redaction utility and lint rule |
| Audio/transcripts persisted | Medium/High | Do not save audio or transcript text |
| Malicious extension update | High | Open source, reproducible build guidance |
| Host page reads storage | Medium | Use `chrome.storage`, not web storage |
| Content Script reads `storage.local` | Medium | `setAccessLevel(TRUSTED_CONTEXTS)` |
| Unexpected OpenAI spend | Medium | Usage estimate, warnings, OpenAI budget guidance |
| Corporate meeting policy violation | Medium/High | User notice and no default storage |
| Local malware | High | Out of scope; user environment risk |

---

## 3. Security Modes

### 3.1 Mode A: Session-only

Default and most secure mode.

```text
Storage:
  chrome.storage.session or in-memory only

Persistence:
  Cleared when browser restarts, extension reloads, or user locks key

User burden:
  User must re-enter API key after restart/reload

Recommended for:
  Security-sensitive users
  Workplace meetings
  Public GitHub users
```

Rules:

- API key is not persisted.
- API key is never written to `storage.local`.
- API key is never written to `storage.sync`.
- API key is removed on lock/stop if user chooses.
- API key is not displayed after entry.

### 3.2 Mode B: Encrypted local

Convenience mode.

```text
Storage:
  Encrypted ciphertext in chrome.storage.local

Unlock:
  User passphrase

Persistence:
  Ciphertext persists locally

Plain key:
  Available only after unlock in trusted context
```

Stored data shape:

```ts
export type EncryptedApiKeyRecord = {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  saltBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
  keyHint: string;
  createdAt: string;
};
```

Rules:

- Do not store passphrase.
- Do not store plaintext API key.
- Use random salt.
- Use random IV.
- Use AES-GCM.
- Wipe decrypted key from session storage on lock.
- Show only masked hint, e.g. `sk-...abcd`.

### 3.3 Mode C: Local broker

Advanced future option.

```text
Chrome Extension
  -> Native Messaging
Local Broker
  -> reads OPENAI_API_KEY from OS environment or OS keychain
  -> creates Realtime client secret
  -> returns only client secret
```

Benefits:

- API key is not stored in Chrome extension storage.
- Better alignment with server-side key handling.
- Better for advanced users.

Tradeoff:

- Requires separate local app/CLI installation.
- More support burden.
- Not MVP.

---

## 4. API Key Handling Rules

### 4.1 Absolute Rules

Never:

- Commit an API key.
- Store an API key in source code.
- Store plaintext API key in `chrome.storage.local`.
- Store API key in `chrome.storage.sync`.
- Store API key in `window.localStorage`.
- Store API key in IndexedDB.
- Send API key to Content Script.
- Send API key to page DOM.
- Send API key to Offscreen Document if avoidable.
- Log API key.
- Include API key in errors.
- Include API key in telemetry.
- Include API key in screenshots.

Always:

- Treat API key as secret.
- Redact all secret-like strings.
- Use only Background Service Worker to call the OpenAI client secret endpoint.
- Pass only short-lived client secret to Offscreen Document.
- Let the user delete key and settings.
- Encourage a dedicated OpenAI Project/API key for this extension.

### 4.2 Redaction

Implement `redaction.ts`.

```ts
export function redactSecret(input: string): string {
  return input
    .replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-REDACTED")
    .replace(/ek_[A-Za-z0-9_\-]{8,}/g, "ek_REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/g, "Bearer REDACTED");
}
```

All error messages must pass through redaction before logging or displaying.

---

## 5. Storage Security

### 5.1 Chrome Storage Areas

Use:

- `chrome.storage.session` for temporary secrets.
- `chrome.storage.local` for encrypted key records and settings.

Do not use:

- `chrome.storage.sync` for secrets.
- Web `localStorage`.
- Web `sessionStorage`.

### 5.2 Access Levels

On startup, the service worker must restrict storage access.

```ts
await chrome.storage.local.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS"
});

await chrome.storage.session.setAccessLevel({
  accessLevel: "TRUSTED_CONTEXTS"
});
```

Rationale:

- `storage.local` is available to content scripts by default unless access level is changed.
- `storage.session` is restricted by default, but set explicitly for defense in depth.

### 5.3 Settings Separation

Separate secrets from non-secret settings.

```text
Secrets:
  security/encryptedLocalKeyStore.ts
  security/sessionKeyStore.ts

Non-secret settings:
  storage/settingsStorage.ts

Usage:
  storage/usageStorage.ts
```

Content Script should not read storage directly.  
It should receive only necessary overlay state through messages.

---

## 6. WebCrypto Design

### 6.1 Encryption

Recommended MVP primitives:

```text
KDF:
  PBKDF2-HMAC-SHA-256

Encryption:
  AES-GCM

Salt:
  crypto.getRandomValues, at least 16 bytes

IV:
  crypto.getRandomValues, 12 bytes for AES-GCM

Iterations:
  Start with 250,000 or higher, configurable
```

Implementation notes:

- Encode API key with `TextEncoder`.
- Derive key from passphrase.
- Encrypt API key.
- Store salt, IV, ciphertext.
- On decrypt, catch failure and show `API_KEY_DECRYPT_FAILED`.
- Never store passphrase.
- Never log decrypt failure payload.

### 6.2 Limitations

This protects against casual local storage inspection.  
It does not protect against:

- A compromised browser profile.
- Malware.
- A malicious future version of the extension.
- A user who enters the passphrase on a compromised machine.

---

## 7. OpenAI Client Secret Design

### 7.1 Why Use Client Secret

The standard API key should not be used for the long-lived media path.  
The service worker creates a short-lived Realtime Translation client secret and gives that to Offscreen Document.

```text
API key:
  Background only

Client secret:
  Offscreen only

Transcript:
  Offscreen -> Background -> Content Script

Page DOM:
  Receives only subtitle text rendered by Content Script
```

### 7.2 Client Secret Request

`openaiClientSecretService.ts` must:

- Validate target language.
- Retrieve API key from KeyVault.
- Send request to OpenAI.
- Return only client secret and expiration metadata.
- Never return API key.
- Redact errors.
- Handle non-2xx responses.

### 7.3 Offscreen Isolation

Offscreen receives:

- stream ID
- client secret
- target language
- volume settings
- subtitle settings

Offscreen does not receive:

- standard provider API key
- user passphrase
- encrypted key record
- full settings dump

---

## 8. Content Script Safety

Content Script must be treated as lower trust because it runs in the context of pages.

Rules:

- Do not pass API key.
- Do not pass passphrase.
- Do not pass encrypted key record.
- Do not pass client secret unless absolutely necessary.
- Do not read `chrome.storage`.
- Do not make network calls.
- Use Shadow DOM for overlay.
- Avoid injecting executable code into the page.
- Do not use `innerHTML` with untrusted transcript text.
- Render transcript with text nodes.

### 8.1 Subtitle Rendering

Use safe rendering.

Good:

```ts
element.textContent = transcriptText;
```

Avoid:

```ts
element.innerHTML = transcriptText;
```

---

## 9. Permissions

### 9.1 Required Permissions

```json
[
  "storage",
  "activeTab",
  "scripting",
  "tabCapture",
  "offscreen"
]
```

### 9.2 Host Permissions

```json
[
  "https://api.openai.com/*",
  "https://api.soniox.com/*",
  "https://stt-rt.soniox.com/*"
]
```

### 9.3 Avoided Permissions

Avoid unless there is a documented need:

- `<all_urls>`
- `tabs`
- `history`
- `cookies`
- `webRequest`
- `debugger`
- `unlimitedStorage`
- `clipboardRead`
- `clipboardWrite`

---

## 10. Data Retention

### 10.1 Do Not Store

Do not store:

- Raw audio
- Meeting audio
- Video audio
- Input transcript
- Output transcript
- Full meeting/video content
- Web page content
- Browsing history
- Standard API key plaintext
- Passphrase

### 10.2 May Store

May store locally:

- Encrypted API key record
- Default target language
- Volume settings
- Subtitle settings
- Local usage seconds
- Estimated cost
- Last selected mode
- Non-sensitive error counts

### 10.3 Usage Data

Local usage records should contain only:

```ts
{
  date: "2026-05-12",
  seconds: 1234,
  estimatedCostUsd: 0.699
}
```

No URL required.  
If a domain is stored for debugging, make it opt-in.

---

## 11. Privacy Notice Draft

The Options page should show the following or equivalent notice.

```text
この拡張は、ブラウザタブの音声を選択した翻訳プロバイダー（OpenAI または Soniox）へ送信します。
OpenAI モードでは翻訳音声と字幕を受け取り、現在の Soniox モードでは翻訳字幕のみを受け取ります。

開発者のサーバーは使用しません。
音声、字幕、会議内容、翻訳履歴は保存しません。
API利用料金は、あなた自身のOpenAIまたはSonioxアカウントに発生します。

会社、顧客、未公開情報、個人情報、機密情報を含む会議で使う場合は、所属組織のルールと参加者の同意を確認してください。
```

---

## 12. Build and Supply Chain Security

### 12.1 Repository

- Do not include `.env`.
- Add `.env*` to `.gitignore`.
- Add secret scanning recommendation.
- Use lockfile.
- Keep dependencies minimal.
- Avoid remote code loading.
- Do not load scripts from CDN.
- Bundle all code at build time.

### 12.2 Recommended `.gitignore`

```gitignore
node_modules/
dist/
.env
.env.*
*.pem
*.key
.DS_Store
```

### 12.3 Logging

Development logging must not include:

- API key
- client secret
- passphrase
- transcript content unless user explicitly enables debug mode
- raw OpenAI response containing sensitive fields

Debug mode must be off by default.

---

## 13. User Guidance

Encourage users to:

- Create a dedicated OpenAI Project.
- Create a dedicated API key for this extension.
- Use restricted key permissions when available.
- Monitor OpenAI usage dashboard.
- Set OpenAI project budget/alerts.
- Rotate/delete the key if they suspect leakage.
- Avoid use in confidential meetings unless allowed.

---

## 14. Security Acceptance Criteria

Security is acceptable for MVP when:

- `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })` is called.
- `chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })` is called.
- API key is never sent to Content Script.
- API key is never sent to Offscreen Document.
- API key is never logged.
- API key is not stored plaintext in local/sync/web storage.
- Encrypted local mode uses WebCrypto AES-GCM.
- Session-only mode clears key after extension reload/browser restart.
- Content Script does not read storage.
- Content Script uses `textContent`, not `innerHTML`, for transcript.
- No audio/transcript content is persisted.
- Network calls go only to `https://api.openai.com/*`, `https://api.soniox.com/*`, and `https://stt-rt.soniox.com/*`.
- Stop flow closes media tracks and peer connection.
- Invalid API key errors are redacted.
- User can delete all settings.
- Privacy notice is visible in Options.

---

## 15. Known Residual Risks

Even after all mitigations:

- A malicious extension update could exfiltrate keys.
- Local malware could capture keys or passphrases.
- A compromised browser profile could leak data.
- Users may paste keys into phishing copies.
- OpenAI or Soniox API charges can still occur if the selected provider key is misused.
- The extension sends meeting/video audio to the selected provider for translation.
- Some organizations may prohibit this usage.

These risks must be disclosed in README and Options.

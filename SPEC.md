# SPEC.md
# Personal Realtime Interpreter - Chrome Extension Specification

作成日: 2026-05-12 JST  
対象: 無料・個人利用・BYOK型Chrome拡張  
モデル: `gpt-realtime-translate`  
開発想定: Codex / Claude Code / TypeScript / React / Vite / Chrome Manifest V3  

---

## 0. Executive Summary

このプロジェクトは、ブラウザ上の会議・動画・ライブ配信の音声を、選択した翻訳プロバイダー（OpenAI Realtime または Soniox Realtime）でリアルタイム翻訳し、ユーザー本人だけが翻訳結果を受け取る無料Chrome拡張である。

商用サブスク、バックエンド、DB、Stripe、ユーザー認証は実装しない。  
BYOKモードでは、ユーザーは自分のOpenAIまたはSoniox APIキーを拡張に入力する。  
Managedモードでは、自社APIが契約状態を検証し、短命のRealtimeセッションだけを拡張へ返す。  
標準APIキーは可能な限りBackground Service Worker内に閉じ込め、Offscreen DocumentやContent Scriptには渡さない。

---

## 1. Product Goals

### 1.1 Primary Goal

ブラウザで開いている会議・動画タブの音声をリアルタイム翻訳し、ユーザーが以下を行えるようにする。

- Google Meet / Teams Web / Zoom Webなどのブラウザ会議を自分だけが翻訳して聞く
- YouTube / ニュース / 講義 / ライブ配信などを翻訳音声と字幕で理解する
- APIキーを自分で管理し、開発者のサーバーを経由せずに利用する

### 1.2 Design Principles

- No backend
- No subscription
- No telemetry
- No analytics
- No storage of audio
- No storage of transcripts
- No storage of meeting content
- No API key in source code
- No API key in Content Script
- No API key in page DOM
- Selected provider API communication only
- BYOK: Bring Your Own Key
- Managed mode uses HTTPS developer API short-lived sessions only
- Managed realtime media uses an allowed WSS origin and starts streaming only after `ready` / `session.ready`

### 1.3 Intended Distribution

初期は以下の配布形態を想定する。

- GitHubで無料公開
- ユーザーが `npm install && npm run build`
- `chrome://extensions` の Load unpacked で読み込み
- Chrome Web Store公開は将来対応

Chrome Web Storeで公開する場合は、プライバシーポリシーとユーザーデータ開示が必須になる。

---

## 2. Scope

### 2.1 MVP In Scope

- Chrome Manifest V3拡張
- Options画面でAPIキー設定
- APIキー保存モード:
  - `session_only`
  - `encrypted_local`
- Popupから翻訳開始/停止
- 現在タブの音声取得
- 元音声音量調整
- 翻訳音声音量調整
- 翻訳先言語選択
- 翻訳字幕オーバーレイ
- ローカル使用時間と推定APIコスト表示
- エラー表示
- セッション終了時のcleanup
- APIキー削除
- 全設定削除

### 2.2 Optional / Later

- Native Messagingを使ったlocal broker mode
- Chrome Web Store公開
- Firefox/Edge対応
- 複数speaker別字幕
- 字幕履歴保存
- 要約
- 用語辞書
- OpenAI project budget取得
- 会議サービス別UI最適化
- Android / iOSアプリ

### 2.3 Explicitly Out of Scope

- サブスク課金
- Stripe
- バックエンド
- DB
- ユーザー認証
- チーム管理
- 法人管理
- 会議相手へ翻訳音声を返す双方向通訳
- OS全体の音声取得
- デスクトップ版Zoom/Teams/Meetの音声取得
- YouTube動画URLからの音声抽出
- 動画/音声のダウンロード
- 録音
- 議事録化
- DRM回避

---

## 3. Target Use Cases

### 3.1 Browser Meeting Listening

User opens a browser meeting tab, clicks the extension, selects target language, and starts translation.  
The extension captures the tab audio and sends it to the selected realtime translation provider. OpenAI mode plays translated audio locally and can show subtitles. Soniox mode currently shows translated subtitles only.

Supported initial targets:

- Google Meet
- Microsoft Teams Web
- Zoom Web

### 3.2 Browser Video Listening

User opens a video or livestream page and uses the extension to listen in another language.

Supported initial targets:

- YouTube
- Online courses
- News websites
- Public webinars
- Conference videos
- Livestreams

### 3.3 One-Way Interpretation

The extension translates audio that the user hears.  
It does not translate the user's microphone and does not send translated speech back into the meeting.

---

## 4. Key Product Decisions

### 4.1 BYOK Architecture

The extension uses the user's own OpenAI API key.  
Because there is no backend, the extension itself must create a short-lived Realtime Translation client secret.

Important compromise:

- OpenAI recommends not putting API keys in browsers.
- This extension is a no-backend BYOK tool, so risk cannot be eliminated.
- The design minimizes exposure by using a trusted-context-only architecture.

### 4.2 Default Security Mode

Default mode should be `session_only`.

```text
session_only:
  API key is entered by the user.
  API key is held only in chrome.storage.session or memory.
  API key is cleared on browser restart, extension reload, or lock.
```

The user may opt into `encrypted_local` for convenience.

```text
encrypted_local:
  API key is encrypted with WebCrypto.
  Encrypted ciphertext is stored in chrome.storage.local.
  User must unlock with passphrase.
  Plain API key is never stored persistently.
```

### 4.3 No Plain Local API Key Storage

Never store the raw API key in:

- `chrome.storage.local`
- `chrome.storage.sync`
- `window.localStorage`
- IndexedDB
- source code
- built assets
- console logs

### 4.4 Short-Lived Client Secret Flow

The standard API key is used only by `background/openaiClientSecretService.ts`.

Flow:

```text
Background Service Worker
  -> reads/decrypts API key
  -> calls OpenAI client secret endpoint
  -> receives short-lived client secret
  -> sends only client secret to Offscreen Document
```

Offscreen Document uses only the short-lived client secret for WebRTC.

---

## 5. OpenAI Realtime Translation

### 5.1 Model

```text
gpt-realtime-translate
```

### 5.2 Translation Session Endpoint

Realtime Translation uses a dedicated translation architecture.

```text
Client secret:
POST https://api.openai.com/v1/realtime/translations/client_secrets

WebRTC call:
POST https://api.openai.com/v1/realtime/translations/calls
```

### 5.3 Client Secret Request Shape

The implementation should verify the current official schema before final coding.  
Target conceptual body:

```json
{
  "session": {
    "model": "gpt-realtime-translate",
    "audio": {
      "input": {
        "transcription": {
          "model": "gpt-realtime-whisper"
        },
        "noise_reduction": {
          "type": "near_field"
        }
      },
      "output": {
        "language": "ja"
      }
    }
  }
}
```

### 5.4 WebRTC Flow

```text
1. Offscreen creates RTCPeerConnection.
2. Offscreen adds captured tab audio track.
3. Offscreen creates data channel named "oai-events".
4. Offscreen creates SDP offer.
5. Offscreen POSTs SDP offer to /v1/realtime/translations/calls using client secret.
6. OpenAI returns SDP answer.
7. Offscreen sets remote description.
8. Translated audio arrives as remote audio track.
9. Transcript deltas arrive via data channel.
```

### 5.5 Important Rules

- Do not call `response.create`.
- Translation starts from incoming audio.
- Use WebRTC for browser-captured audio.
- Use data channel events for transcript deltas and errors.
- Do not manually resample PCM unless switching to WebSocket mode.

---

## 6. Languages

### 6.1 Output Languages

MVP should expose all supported target languages as a select menu.

```ts
export const TARGET_LANGUAGES = [
  { code: "ja", labelJa: "日本語", labelEn: "Japanese" },
  { code: "en", labelJa: "英語", labelEn: "English" },
  { code: "zh", labelJa: "中国語", labelEn: "Chinese" },
  { code: "ko", labelJa: "韓国語", labelEn: "Korean" },
  { code: "es", labelJa: "スペイン語", labelEn: "Spanish" },
  { code: "pt", labelJa: "ポルトガル語", labelEn: "Portuguese" },
  { code: "fr", labelJa: "フランス語", labelEn: "French" },
  { code: "de", labelJa: "ドイツ語", labelEn: "German" },
  { code: "ru", labelJa: "ロシア語", labelEn: "Russian" },
  { code: "hi", labelJa: "ヒンディー語", labelEn: "Hindi" },
  { code: "id", labelJa: "インドネシア語", labelEn: "Indonesian" },
  { code: "vi", labelJa: "ベトナム語", labelEn: "Vietnamese" },
  { code: "it", labelJa: "イタリア語", labelEn: "Italian" }
] as const;
```

### 6.2 Defaults

```ts
defaultTargetLanguage = "ja";
uiLanguage = "ja";
```

---

## 7. Chrome Extension Architecture

### 7.1 Runtime Components

```text
Popup UI
  - User controls session start/stop.
  - Shows status, language, volume, usage.

Options UI
  - API key setup.
  - Security mode selection.
  - Default settings.

Background Service Worker
  - Orchestrates everything.
  - Holds or unlocks API key.
  - Creates OpenAI client secret.
  - Gets tabCapture stream ID.
  - Creates Offscreen Document.
  - Injects content script.
  - Routes messages.

Offscreen Document
  - Captures tab audio from stream ID.
  - Preserves or mutes original audio.
  - Connects to OpenAI via WebRTC.
  - Plays translated audio.
  - Emits transcript deltas.

Content Script
  - Displays subtitle overlay.
  - Does not handle API key.
  - Does not call OpenAI.
```

### 7.2 Why Offscreen Document

Manifest V3 service workers cannot directly use DOM/window APIs needed for media and WebRTC handling.  
Offscreen Document handles media APIs while remaining part of the extension's trusted environment.

### 7.3 Why Content Script

Content Script is used only for UI overlay inside the active tab.  
It must not receive the OpenAI API key or full client secret unless absolutely necessary.  
Preferred: Content Script receives only transcript text and UI status.

---

## 8. Manifest

Recommended manifest:

```json
{
  "manifest_version": 3,
  "name": "Personal Realtime Interpreter",
  "version": "0.1.0",
  "description": "Free BYOK realtime translation for browser meetings and videos.",
  "minimum_chrome_version": "116",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "tabCapture",
    "offscreen"
  ],
  "host_permissions": [
    "https://api.openai.com/*",
    "https://api.soniox.com/*",
    "https://stt-rt.soniox.com/*"
  ],
  "background": {
    "service_worker": "background/serviceWorker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/index.html"
  },
  "options_page": "options/index.html",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Avoid these permissions unless justified:

- `<all_urls>`
- `tabs`
- `history`
- `cookies`
- `webRequest`
- `debugger`
- `unlimitedStorage`

---

## 9. Project Structure

```text
personal-realtime-interpreter/
  package.json
  tsconfig.json
  vite.config.ts
  manifest.config.ts
  README.md
  SPEC.md
  SECURITY.md
  TASKS.md

  public/
    icons/
      icon-16.png
      icon-48.png
      icon-128.png

  src/
    background/
      serviceWorker.ts
      messageRouter.ts
      sessionController.ts
      openaiClientSecretService.ts
      keyAccessController.ts
      tabCaptureController.ts
      offscreenController.ts
      usageController.ts

    security/
      keyVault.ts
      keyStorageMode.ts
      sessionKeyStore.ts
      encryptedLocalKeyStore.ts
      passphraseCrypto.ts
      redaction.ts
      trustedStorage.ts

    offscreen/
      offscreen.html
      offscreen.ts
      tabAudioStream.ts
      audioGraph.ts
      realtimeTranslationPeer.ts
      translatedAudioPlayer.ts
      transcriptEventParser.ts
      offscreenState.ts

    content/
      overlay.ts
      subtitleOverlay.ts
      overlayStyles.ts
      contentMessageHandler.ts

    popup/
      index.html
      PopupApp.tsx
      components/
        StartStopButton.tsx
        LanguageSelect.tsx
        VolumeControls.tsx
        StatusPanel.tsx
        UsagePanel.tsx
        SecurityModeBadge.tsx

    options/
      index.html
      OptionsApp.tsx
      components/
        ApiKeySetup.tsx
        SecurityModeSelect.tsx
        DefaultSettingsForm.tsx
        PrivacyNotice.tsx
        DangerZone.tsx

    lib/
      constants/
        languages.ts
        endpoints.ts
        defaults.ts
      messaging/
        messageTypes.ts
        sendMessage.ts
        portNames.ts
      storage/
        settingsStorage.ts
        usageStorage.ts
      state/
        sessionState.ts
      errors/
        errors.ts
        userFacingMessages.ts
      usage/
        costEstimator.ts
        localUsageTimer.ts
      utils/
        assertNever.ts
        sleep.ts
        time.ts

    types/
      chrome.d.ts
      settings.ts
      session.ts
      openaiRealtime.ts
      messages.ts
```

---

## 10. Module Responsibilities

### 10.1 `background/serviceWorker.ts`

Entry point.

Responsibilities:

- Set storage access levels on startup.
- Register message listeners.
- Handle extension lifecycle.
- Delegate logic to controllers.
- Avoid direct API key logging.

### 10.2 `background/sessionController.ts`

Session orchestration.

Responsibilities:

- Start translation session.
- Stop translation session.
- Maintain session state.
- Handle active tab changes or tab close.
- Prevent concurrent sessions unless explicitly supported.
- Send status updates to popup and content script.

### 10.3 `background/openaiClientSecretService.ts`

The only module that uses the standard OpenAI API key.

Responsibilities:

- Request API key from KeyVault.
- Validate target language.
- Create Realtime Translation client secret.
- Return client secret to session controller.
- Redact all sensitive values in errors.

### 10.4 `background/tabCaptureController.ts`

Responsibilities:

- Use `chrome.tabCapture.getMediaStreamId`.
- Scope stream ID to active tab.
- Return stream ID to session controller.
- Report tab capture errors.

### 10.5 `background/offscreenController.ts`

Responsibilities:

- Create Offscreen Document if absent.
- Close Offscreen Document when idle.
- Send `OFFSCREEN_START` and `OFFSCREEN_STOP`.
- Receive offscreen status events.

### 10.6 `security/keyVault.ts`

Main key abstraction.

```ts
export type KeyStorageMode = "session_only" | "encrypted_local" | "local_broker";

export interface KeyVault {
  getMode(): Promise<KeyStorageMode>;
  setMode(mode: KeyStorageMode): Promise<void>;
  hasKey(): Promise<boolean>;
  storeSessionKey(apiKey: string): Promise<void>;
  storeEncryptedKey(apiKey: string, passphrase: string): Promise<void>;
  unlock(passphrase?: string): Promise<void>;
  getApiKeyForTrustedContext(): Promise<string>;
  lock(): Promise<void>;
  deleteKey(): Promise<void>;
}
```

Rules:

- Only Background Service Worker calls `getApiKeyForTrustedContext()`.
- Never send the API key through extension messages.
- Never expose key to Content Script.
- Never include key in thrown errors.

### 10.7 `security/passphraseCrypto.ts`

Responsibilities:

- Use WebCrypto.
- Generate random salt and IV.
- Derive encryption key from passphrase.
- Encrypt API key with AES-GCM.
- Decrypt API key after user unlock.
- Avoid storing passphrase.

Recommended conceptual primitives:

- PBKDF2 or Argon2 if available through a vetted library
- AES-GCM
- Random 96-bit IV for AES-GCM
- Random 128-bit or 256-bit salt

MVP can use WebCrypto PBKDF2 + AES-GCM.

### 10.8 `offscreen/offscreen.ts`

Responsibilities:

- Receive `OFFSCREEN_START`.
- Resolve stream ID into tab audio stream.
- Build audio graph.
- Start WebRTC translation.
- Send transcript deltas to background.
- Send connection state to background.
- Cleanup on stop.

### 10.9 `offscreen/audioGraph.ts`

Responsibilities:

- Play original tab audio locally if enabled.
- Control original audio gain.
- Control translated audio gain.
- Provide cleanup.

### 10.10 `offscreen/realtimeTranslationPeer.ts`

Responsibilities:

- Create `RTCPeerConnection`.
- Add captured audio track.
- Create `oai-events` data channel.
- POST SDP offer to OpenAI calls endpoint.
- Set SDP answer.
- Receive remote audio track.
- Parse data channel events.
- Close connection.

### 10.11 `content/subtitleOverlay.ts`

Responsibilities:

- Create Shadow DOM overlay.
- Render translated subtitle text.
- Optionally render source transcript.
- Show session status.
- Remove overlay on stop.

---

## 11. Settings Schema

```ts
export type TargetLanguage =
  | "ja" | "en" | "zh" | "ko" | "es" | "pt" | "fr"
  | "de" | "ru" | "hi" | "id" | "vi" | "it";

export type KeyStorageMode =
  | "session_only"
  | "encrypted_local"
  | "local_broker";

export type UserSettings = {
  keyStorageMode: KeyStorageMode;
  encryptedKey?: {
    version: 1;
    kdf: "PBKDF2-SHA256";
    iterations: number;
    saltBase64: string;
    ivBase64: string;
    ciphertextBase64: string;
    keyHint: string;
    createdAt: string;
  };
  defaultTargetLanguage: TargetLanguage;
  subtitleEnabled: boolean;
  showSourceTranscript: boolean;
  originalVolume: number;
  translationVolume: number;
  muteOriginalOnStart: boolean;
  autoStopOnTabClose: boolean;
  localUsage: {
    totalSeconds: number;
    byDay: Record<string, number>;
    byMonth: Record<string, number>;
  };
};
```

Validation:

- Volumes must be `0 <= value <= 1`.
- Target language must be in `TARGET_LANGUAGES`.
- API key should pass only basic shape checks, not strict assumptions.
- Never store API key in settings as plaintext.

---

## 12. Message Types

```ts
export type ExtensionMessage =
  | {
      type: "POPUP_START_TRANSLATION";
      targetLanguage: TargetLanguage;
      originalVolume: number;
      translationVolume: number;
      subtitleEnabled: boolean;
      showSourceTranscript: boolean;
    }
  | {
      type: "POPUP_STOP_TRANSLATION";
      reason: "user";
    }
  | {
      type: "OFFSCREEN_START";
      tabId: number;
      streamId: string;
      clientSecret: string;
      targetLanguage: TargetLanguage;
      originalVolume: number;
      translationVolume: number;
      subtitleEnabled: boolean;
      showSourceTranscript: boolean;
    }
  | {
      type: "OFFSCREEN_STOP";
      reason: "user" | "tab_closed" | "error";
    }
  | {
      type: "SESSION_STATUS";
      status:
        | "idle"
        | "preparing"
        | "capturing"
        | "connecting"
        | "connected"
        | "stopping"
        | "stopped"
        | "error";
      errorCode?: string;
      errorMessage?: string;
    }
  | {
      type: "TRANSCRIPT_DELTA";
      transcriptType: "source" | "translation";
      delta: string;
      final?: boolean;
      timestampMs?: number;
    }
  | {
      type: "OVERLAY_INIT";
      targetLanguage: TargetLanguage;
      showSourceTranscript: boolean;
    }
  | {
      type: "OVERLAY_REMOVE";
    }
  | {
      type: "VOLUME_UPDATE";
      originalVolume?: number;
      translationVolume?: number;
    }
  | {
      type: "USAGE_TICK";
      elapsedSeconds: number;
      estimatedCostUsd: number;
    };
```

---

## 13. Main Flow

### 13.1 Setup Flow

```text
1. User opens Options.
2. User selects security mode.
3. User enters OpenAI API key.
4. If session_only:
   - Store key in chrome.storage.session.
5. If encrypted_local:
   - User enters passphrase.
   - Encrypt key with WebCrypto.
   - Store ciphertext in chrome.storage.local.
6. UI shows only key hint, e.g. sk-...abcd.
```

### 13.2 Start Translation Flow

```text
1. User opens meeting/video tab.
2. User opens popup.
3. User selects target language.
4. User clicks Start.
5. Background validates state.
6. Background injects content overlay.
7. Background creates offscreen document.
8. Background gets tabCapture stream ID.
9. Background obtains API key through KeyVault.
10. Background creates OpenAI client secret.
11. Background sends stream ID + client secret to offscreen.
12. Offscreen captures tab audio.
13. Offscreen starts original audio playback according to settings.
14. Offscreen starts WebRTC Realtime Translation.
15. Offscreen plays translated audio.
16. Offscreen sends transcript deltas to background.
17. Background forwards transcript deltas to content overlay.
18. Popup shows Connected state and usage timer.
```

### 13.3 Stop Flow

```text
1. User clicks Stop.
2. Background sends OFFSCREEN_STOP.
3. Offscreen closes peer connection.
4. Offscreen stops media tracks.
5. Offscreen closes audio context.
6. Offscreen stops translated audio element.
7. Background removes content overlay.
8. Background stores local usage seconds.
9. Session state becomes idle.
```

### 13.4 Error Flow

```text
1. Error occurs in any component.
2. Component sends SESSION_STATUS error.
3. Background attempts cleanup.
4. Popup shows user-facing error.
5. Overlay optionally shows error badge.
6. No sensitive data is logged.
```

---

## 14. Error Codes

```ts
export type ErrorCode =
  | "API_KEY_MISSING"
  | "API_KEY_LOCKED"
  | "API_KEY_DECRYPT_FAILED"
  | "CLIENT_SECRET_FAILED"
  | "TAB_CAPTURE_FAILED"
  | "NO_AUDIO_TRACK"
  | "OFFSCREEN_CREATE_FAILED"
  | "WEBRTC_FAILED"
  | "SDP_OFFER_FAILED"
  | "REMOTE_AUDIO_FAILED"
  | "DATA_CHANNEL_FAILED"
  | "CONTENT_SCRIPT_FAILED"
  | "AUTOPLAY_BLOCKED"
  | "PERMISSION_FAILED"
  | "UNSUPPORTED_BROWSER"
  | "SESSION_ALREADY_RUNNING"
  | "UNKNOWN_ERROR";
```

User-facing messages should be in Japanese by default.

---

## 15. Usage and Cost Estimation

Local-only estimate:

```ts
const GPT_REALTIME_TRANSLATE_USD_PER_MIN = 0.034;
const estimatedCostUsd = (seconds / 60) * GPT_REALTIME_TRANSLATE_USD_PER_MIN;
```

Display:

```text
今回: 12分
今日: 38分
今月: 260分
推定APIコスト: $8.84
```

Important:

- This is only an estimate.
- Final billing is determined by the selected provider account usage.
- User should set provider-side budgets or alerts and monitor usage.

---

## 16. UI Specification

### 16.1 Popup

Sections:

```text
Header:
  Personal Realtime Interpreter
  Status badge

Main:
  Target language select
  Start / Stop button

Audio:
  Original volume slider
  Translation volume slider
  Mute original on start checkbox

Subtitles:
  Show translated subtitles
  Show source transcript

Security:
  Security mode badge
  Key status: configured / locked / missing

Usage:
  Current session duration
  Today
  This month
  Estimated cost

Footer:
  Open Options
  Clear session key
```

### 16.2 Options

Sections:

```text
API Key:
  Security mode select
  API key password input
  Passphrase input for encrypted mode
  Save key
  Unlock key
  Lock key
  Delete key

Defaults:
  Default target language
  Subtitle default
  Original volume default
  Translation volume default
  Mute original default

Privacy:
  No backend notice
  Selected provider transmission notice
  Meeting confidentiality warning

Danger Zone:
  Clear all settings
```

### 16.3 Subtitle Overlay

Behavior:

- Bottom-center fixed overlay.
- Shadow DOM.
- High z-index.
- Does not block pointer events unless controls are shown.
- Shows only the last few lines.
- Has a compact status badge.
- Can be removed on stop.

---

## 17. Testing Strategy

### 17.1 Unit Tests

Target modules:

- `passphraseCrypto.ts`
- `keyVault.ts`
- `redaction.ts`
- `languages.ts`
- `costEstimator.ts`
- `messageTypes.ts`
- `transcriptEventParser.ts`

### 17.2 Integration Tests

Manual or Playwright-based:

- Save session-only API key.
- Save encrypted API key.
- Unlock encrypted key.
- Delete key.
- Start translation on YouTube.
- Stop translation.
- Verify cleanup.
- Verify Content Script never receives API key.
- Verify no API key in console logs.
- Verify local usage increments.

### 17.3 Manual QA Checklist

- Google Meet tab capture
- Teams Web tab capture
- Zoom Web tab capture
- YouTube tab capture
- Original audio mute/unmute
- Translation volume control
- Subtitle overlay display
- Autoplay errors
- Network failure
- API key invalid
- Browser restart clears session key
- Extension reload clears session key

---

## 18. References

OpenAI:
- https://developers.openai.com/api/docs/guides/realtime-translation
- https://developers.openai.com/cookbook/examples/voice_solutions/realtime_translation_guide
- https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

Chrome:
- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://developer.chrome.com/docs/extensions/reference/api/storage/StorageArea
- https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- https://developer.chrome.com/docs/extensions/reference/api/offscreen

---

## 19. Acceptance Criteria

MVP is complete when:

- Build succeeds.
- Extension loads via Load unpacked.
- User can set API key in `session_only` mode.
- User can set API key in `encrypted_local` mode.
- User can start translation on YouTube.
- User can start translation on Google Meet.
- Translated audio plays locally.
- Translated subtitles appear on active tab.
- Original audio volume is adjustable.
- Translation volume is adjustable.
- Stop cleans up peer connection, media tracks, audio contexts, and overlay.
- API key is not passed to Content Script.
- API key is not logged.
- No audio/transcript content is persisted.
- Local usage estimate is displayed.

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_USER_SETTINGS,
  loadUserSettings,
  saveUserSettings
} from "../lib/storage/settingsStorage";
import {
  hasManagedHostPermission,
  MANAGED_SESSION_URL,
  parseManagedHttpsEndpoint
} from "../lib/constants/managedService";
import type { TranslationProvider } from "../lib/constants/providers";
import { ChromeKeyVault } from "../security/keyVault";
import type { KeyStorageMode } from "../security/keyStorageMode";
import type { UserSettings } from "../types/settings";
import { ApiKeySetup } from "./components/ApiKeySetup";
import { DefaultSettingsForm } from "./components/DefaultSettingsForm";
import { PrivacyNotice } from "./components/PrivacyNotice";
import { SecurityModeSelect } from "./components/SecurityModeSelect";
import { ServiceModeSelect } from "./components/ServiceModeSelect";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import "./options.css";

function OptionsApp() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [mode, setMode] = useState<KeyStorageMode>("session_only");
  const [keyStatus, setKeyStatus] = useState("確認中");
  const [settingsMessage, setSettingsMessage] = useState("設定を読み込んでいます。");
  const [isSettingsBusy, setIsSettingsBusy] = useState(false);
  const keyVault = createKeyVault(settings.translationProvider);
  const isManagedServiceReady = getManagedServiceReadiness();

  useEffect(() => {
    if (typeof chrome === "undefined" || chrome.storage === undefined) {
      setKeyStatus("Chrome拡張ページとして開かれていません。");
      setSettingsMessage("Chrome拡張ページで開くと設定を保存できます。");
      return;
    }

    void loadInitialState(setSettings, setMode, setKeyStatus, setSettingsMessage);
  }, []);

  async function handleModeChange(nextMode: KeyStorageMode): Promise<void> {
    if (keyVault === undefined) {
      return;
    }

    setIsSettingsBusy(true);

    const nextSettings = {
      ...settings,
      keyStorageMode: nextMode
    };

    try {
      await keyVault.setMode(nextMode);
      await saveUserSettings(nextSettings);
      setSettings(nextSettings);
      setMode(nextMode);
      setSettingsMessage("保存モードを更新しました。");
      await refreshKeyStatus(keyVault, setKeyStatus);
    } catch {
      setSettingsMessage("保存モードの更新に失敗しました。");
    } finally {
      setIsSettingsBusy(false);
    }
  }

  async function handleSettingsChange(nextSettings: UserSettings): Promise<void> {
    const nextKeyVault = createKeyVault(nextSettings.translationProvider);

    if (nextKeyVault === undefined) {
      setSettings(nextSettings);
      return;
    }

    setIsSettingsBusy(true);

    try {
      const nextMode = await nextKeyVault.getMode();
      const settingsToSave = {
        ...nextSettings,
        keyStorageMode: nextMode
      };

      await saveUserSettings(settingsToSave);
      setSettings(settingsToSave);
      setMode(nextMode);
      setSettingsMessage("設定を保存しました。");
      await refreshKeyStatus(nextKeyVault, setKeyStatus);
    } catch {
      setSettingsMessage("設定の保存に失敗しました。");
    } finally {
      setIsSettingsBusy(false);
    }
  }

  async function handleKeyChanged(): Promise<void> {
    if (keyVault === undefined) {
      return;
    }

    await refreshKeyStatus(keyVault, setKeyStatus);
  }

  return (
    <main className="options-shell">
      <section className="hero">
        <p className="eyebrow">BYOK Chrome Extension</p>
        <h1>Personal Realtime Interpreter</h1>
        <p>
          翻訳エンジンを選び、OpenAIまたはSonioxのAPIキーをユーザー自身で管理します。
          通常APIキーはtrusted contextだけで扱い、音声処理には短命キーを使います。
        </p>
      </section>

      <section className="status-strip" aria-label="key status">
        <strong>キー状態</strong>
        <span>{keyStatus}</span>
        <strong>設定状態</strong>
        <span>{settingsMessage}</span>
      </section>

      <ServiceModeSelect
        settings={settings}
        disabled={isSettingsBusy || keyVault === undefined}
        onSettingsChange={(nextSettings) => void handleSettingsChange(nextSettings)}
      />

      {settings.serviceMode === "managed" ? (
        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Managed Plan</p>
            <h2>有料サービス接続</h2>
          </div>
          <p className="muted">
            Managedモードでは個人のAPIキーを使わず、自社APIが短命のRealtimeセッションを発行します。
            サインイン、契約状態、利用上限は自社API側で検証します。
            {!isManagedServiceReady
              ? " Managed mode requires an HTTPS API URL and exact manifest host permission."
              : ""}
          </p>
        </section>
      ) : (
        <>
          <SecurityModeSelect
        mode={mode}
        disabled={isSettingsBusy || keyVault === undefined}
        onModeChange={(nextMode) => void handleModeChange(nextMode)}
      />

      {keyVault === undefined ? (
        <section className="panel">
          <h2>Chrome拡張ページで開いてください</h2>
          <p className="muted">
            APIキー操作はChrome拡張のOptionsページでのみ有効です。
          </p>
        </section>
      ) : (
        <ApiKeySetup
          key={settings.translationProvider}
          provider={settings.translationProvider}
          mode={mode}
          keyVault={keyVault}
          onKeyChanged={handleKeyChanged}
        />
      )}
        </>
      )}

      <DefaultSettingsForm
        settings={settings}
        disabled={isSettingsBusy || keyVault === undefined}
        onSettingsChange={(nextSettings) => void handleSettingsChange(nextSettings)}
      />

      <PrivacyNotice />
    </main>
  );
}

function createKeyVault(provider: TranslationProvider): ChromeKeyVault | undefined {
  if (typeof chrome === "undefined" || chrome.storage === undefined) {
    return undefined;
  }

  return new ChromeKeyVault(chrome.storage.local, chrome.storage.session, provider);
}

function getManagedServiceReadiness(): boolean {
  if (parseManagedHttpsEndpoint(MANAGED_SESSION_URL) === undefined) {
    return false;
  }

  if (typeof chrome === "undefined" || chrome.runtime?.getManifest === undefined) {
    return false;
  }

  return hasManagedHostPermission(
    chrome.runtime.getManifest().host_permissions,
    MANAGED_SESSION_URL
  );
}

async function loadInitialState(
  setSettings: (settings: UserSettings) => void,
  setMode: (mode: KeyStorageMode) => void,
  setKeyStatus: (status: string) => void,
  setSettingsMessage: (message: string) => void
): Promise<void> {
  try {
    const loadedSettings = await loadUserSettings();
    const keyVault = createKeyVault(loadedSettings.translationProvider);

    if (keyVault === undefined) {
      setSettingsMessage("設定の読み込みに失敗しました。");
      setKeyStatus("確認できませんでした。");
      return;
    }

    const loadedMode = await keyVault.getMode();
    const normalizedSettings = {
      ...loadedSettings,
      keyStorageMode: loadedMode
    };

    setSettings(normalizedSettings);
    setMode(loadedMode);
    setSettingsMessage("設定を読み込みました。");
    await refreshKeyStatus(keyVault, setKeyStatus);
  } catch {
    setSettingsMessage("設定の読み込みに失敗しました。");
    setKeyStatus("確認できませんでした。");
  }
}

async function refreshKeyStatus(
  keyVault: ChromeKeyVault,
  setKeyStatus: (status: string) => void
): Promise<void> {
  const [mode, availability] = await Promise.all([
    keyVault.getMode(),
    keyVault.getKeyAvailability()
  ]);

  if (availability === "missing") {
    setKeyStatus("未設定");
    return;
  }

  if (availability === "locked") {
    setKeyStatus("暗号化キーあり（ロック中）");
    return;
  }

  setKeyStatus(mode === "encrypted_local" ? "暗号化キー利用可能" : "セッションキー利用可能");
}

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Options root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary title="Optionsを表示できません">
      <OptionsApp />
    </ErrorBoundary>
  </StrictMode>
);

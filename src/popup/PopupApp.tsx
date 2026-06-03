import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_USER_SETTINGS,
  loadUserSettings,
  saveUserSettings
} from "../lib/storage/settingsStorage";
import {
  getLocalDateKey,
  getLocalMonthKey
} from "../lib/usage/localUsageTimer";
import {
  TRANSLATION_PROVIDERS,
  type TranslationProvider
} from "../lib/constants/providers";
import {
  hasManagedHostPermission,
  MANAGED_SESSION_URL,
  parseManagedHttpsEndpoint
} from "../lib/constants/managedService";
import { ChromeKeyVault, type KeyAvailability } from "../security/keyVault";
import type { KeyStorageMode } from "../security/keyStorageMode";
import type { UserSettings } from "../types/settings";
import type { ExtensionMessage, SessionStatus } from "../types/messages";
import { createPopupStartMessage } from "./startMessage";
import { LanguageSelect } from "./components/LanguageSelect";
import { SecurityModeBadge } from "./components/SecurityModeBadge";
import { StartStopButton } from "./components/StartStopButton";
import { StatusPanel } from "./components/StatusPanel";
import { UsagePanel } from "./components/UsagePanel";
import { VolumeControls } from "./components/VolumeControls";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import "./popup.css";

function PopupApp() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const keyVault = createKeyVault(settings.translationProvider);
  const [mode, setMode] = useState<KeyStorageMode>("session_only");
  const [keyAvailability, setKeyAvailability] = useState<KeyAvailability>("missing");
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [currentSessionSeconds, setCurrentSessionSeconds] = useState(0);

  useEffect(() => {
    if (typeof chrome === "undefined" || chrome.storage === undefined) {
      setErrorMessage("Chrome拡張のPopupとして開くと操作できます。");
      return;
    }

    void refreshPopupState(
      setSettings,
      setMode,
      setKeyAvailability,
      setStatus,
      setErrorMessage
    );
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || chrome.runtime?.onMessage === undefined) {
      return;
    }

    const listener = (message: unknown) => {
      handleRuntimeMessage(
        message,
        setStatus,
        setErrorMessage,
        setCurrentSessionSeconds,
        setSettings
      );
      return false;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function updateSettings(nextSettings: UserSettings): Promise<void> {
    const nextKeyVault = createKeyVault(nextSettings.translationProvider);

    if (nextKeyVault === undefined) {
      setSettings(nextSettings);
      return;
    }

    const nextMode = await nextKeyVault.getMode();
    const settingsToSave = {
      ...nextSettings,
      keyStorageMode: nextMode
    };

    setSettings(settingsToSave);
    setMode(nextMode);
    setKeyAvailability(await nextKeyVault.getKeyAvailability());
    await saveUserSettings(settingsToSave);
  }

  async function startTranslation(): Promise<void> {
    setStatus("preparing");
    setErrorMessage(undefined);

    try {
      await sendExtensionMessage({
        ...createPopupStartMessage(settings)
      });
    } catch {
      setStatus("error");
      setErrorMessage("バックグラウンドのセッション制御に失敗しました。");
    }
  }

  async function stopTranslation(): Promise<void> {
    setStatus("stopping");
    setErrorMessage(undefined);

    try {
      await sendExtensionMessage({
        type: "POPUP_STOP_TRANSLATION",
        reason: "user"
      });
      setStatus("stopped");
    } catch {
      setStatus("error");
      setErrorMessage("停止メッセージを送信できませんでした。");
    }
  }

  async function updateVolumes(values: {
    originalVolume: number;
    translationVolume: number;
    muteOriginalOnStart: boolean;
  }): Promise<void> {
    const nextSettings = {
      ...settings,
      ...values
    };

    await updateSettings(nextSettings);

    if (status === "connected") {
      await sendExtensionMessage({
        type: "VOLUME_UPDATE",
        originalVolume: values.originalVolume,
        translationVolume: values.translationVolume
      }).catch(() => undefined);
    }
  }

  const isExtensionPage = keyVault !== undefined;
  const isManagedServiceReady = getManagedServiceReadiness();
  const isStartDisabled =
    !isExtensionPage ||
    (settings.serviceMode === "byok" && keyAvailability !== "available") ||
    (settings.serviceMode === "managed" && !isManagedServiceReady);
  const isSonioxProvider = settings.translationProvider === "soniox";
  const todaySeconds = settings.localUsage.byDay[getLocalDateKey()] ?? 0;
  const monthSeconds = settings.localUsage.byMonth[getLocalMonthKey()] ?? 0;

  return (
    <main className="popup-shell">
      <header>
        <p className="eyebrow">Realtime Translation</p>
        <h1>Personal Realtime Interpreter</h1>
      </header>

      {settings.serviceMode === "byok" ? (
        <SecurityModeBadge mode={mode} keyAvailability={keyAvailability} />
      ) : (
        <section className="control-card">
          <strong>Managed mode</strong>
          <p className="muted">
            自社APIの有料セッションを使います。個人APIキーは不要です。
            {!isManagedServiceReady
              ? " Managed mode requires an HTTPS API URL and exact manifest host permission."
              : ""}
          </p>
        </section>
      )}

      <StatusPanel status={status} errorMessage={errorMessage} />

      <section className="control-card">
        <label className="field">
          <span>翻訳エンジン</span>
          <select
            value={settings.translationProvider}
            disabled={!isExtensionPage}
            onChange={(event) => {
              const translationProvider = event.currentTarget.value as TranslationProvider;
              void updateSettings({
                ...settings,
                translationProvider,
                subtitleEnabled: translationProvider === "soniox" ? true : settings.subtitleEnabled
              });
            }}
          >
            {TRANSLATION_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <LanguageSelect
        value={settings.defaultTargetLanguage}
        disabled={!isExtensionPage}
        onChange={(defaultTargetLanguage) =>
          void updateSettings({
            ...settings,
            defaultTargetLanguage
          })
        }
      />

      <VolumeControls
        originalVolume={settings.originalVolume}
        translationVolume={settings.translationVolume}
        muteOriginalOnStart={settings.muteOriginalOnStart}
        disabled={!isExtensionPage}
        onChange={(values) => void updateVolumes(values)}
      />

      <section className="control-card">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={isSonioxProvider ? true : settings.subtitleEnabled}
            disabled={!isExtensionPage || isSonioxProvider}
            onChange={(event) =>
              void updateSettings({
                ...settings,
                subtitleEnabled: event.currentTarget.checked
              })
            }
          />
          翻訳字幕を表示
        </label>
        {isSonioxProvider ? (
          <p className="muted">Soniox は字幕翻訳のみのため、字幕表示は常に有効です。</p>
        ) : null}
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={settings.showSourceTranscript}
            disabled={!isExtensionPage}
            onChange={(event) =>
              void updateSettings({
                ...settings,
                showSourceTranscript: event.currentTarget.checked
              })
            }
          />
          元の文字起こしも表示
        </label>
      </section>

      <StartStopButton
        status={status}
        disabled={isStartDisabled}
        onStart={() => void startTranslation()}
        onStop={() => void stopTranslation()}
      />

      <UsagePanel
        serviceMode={settings.serviceMode}
        provider={settings.translationProvider}
        currentSessionSeconds={currentSessionSeconds}
        todaySeconds={todaySeconds}
        monthSeconds={monthSeconds}
      />

      <button type="button" className="secondary-button" onClick={() => openOptionsPage()}>
        Optionsを開く
      </button>
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

async function refreshPopupState(
  setSettings: (settings: UserSettings) => void,
  setMode: (mode: KeyStorageMode) => void,
  setKeyAvailability: (availability: KeyAvailability) => void,
  setStatus: (status: SessionStatus) => void,
  setErrorMessage: (message: string | undefined) => void
): Promise<void> {
  const loadedSettings = await loadUserSettings();
  const keyVault = createKeyVault(loadedSettings.translationProvider);

  if (keyVault === undefined) {
    return;
  }

  const [loadedMode, loadedKeyAvailability, statusResult, lastStatusResult] = await Promise.all([
    keyVault.getMode(),
    keyVault.getKeyAvailability(),
    getSessionStatus().catch(() => undefined),
    getLastSessionStatus().catch(() => undefined)
  ]);

  setSettings({
    ...loadedSettings,
    keyStorageMode: loadedMode
  });
  setMode(loadedMode);
  setKeyAvailability(loadedKeyAvailability);

  const currentStatus = isRouteResult(statusResult) ? statusResult.statusMessage : undefined;
  const lastStatus = isRouteResult(lastStatusResult) ? lastStatusResult.statusMessage : undefined;

  if (currentStatus !== undefined && currentStatus.status !== "idle" && currentStatus.status !== "stopped") {
    setStatus(currentStatus.status);
    setErrorMessage(currentStatus.errorMessage);
    return;
  }

  if (lastStatus?.status === "error") {
    setStatus("error");
    setErrorMessage(lastStatus.errorMessage);
    return;
  }

  if (currentStatus !== undefined) {
    setStatus(currentStatus.status);
    setErrorMessage(currentStatus.errorMessage);
  }
}

async function sendExtensionMessage<TResponse = unknown>(message: ExtensionMessage): Promise<TResponse> {
  if (typeof chrome === "undefined" || chrome.runtime === undefined) {
    throw new Error("Chrome runtime is unavailable.");
  }

  return chrome.runtime.sendMessage(message) as Promise<TResponse>;
}

async function getSessionStatus(): Promise<RouteResult> {
  return sendExtensionMessage<RouteResult>({
    type: "POPUP_GET_STATUS"
  });
}

async function getLastSessionStatus(): Promise<RouteResult> {
  return sendExtensionMessage<RouteResult>({
    type: "POPUP_GET_LAST_STATUS"
  });
}

function openOptionsPage(): void {
  if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage !== undefined) {
    void chrome.runtime.openOptionsPage();
  }
}

function handleRuntimeMessage(
  message: unknown,
  setStatus: (status: SessionStatus) => void,
  setErrorMessage: (message: string | undefined) => void,
  setCurrentSessionSeconds: (seconds: number) => void,
  setSettings: (updater: (settings: UserSettings) => UserSettings) => void
): void {
  if (!isRecord(message) || typeof message.type !== "string") {
    return;
  }

  if (message.type === "SESSION_STATUS" && isSessionStatus(message.status)) {
    setStatus(message.status);
    setErrorMessage(typeof message.errorMessage === "string" ? message.errorMessage : undefined);

    if (message.status === "stopped" || message.status === "idle" || message.status === "error") {
      setCurrentSessionSeconds(0);
    }
    return;
  }

  if (message.type === "USAGE_TICK" && isUsageTickMessage(message)) {
    setCurrentSessionSeconds(message.elapsedSeconds);
    setSettings((settings) => ({
      ...settings,
      localUsage: {
        totalSeconds: message.totalSeconds,
        byDay: {
          ...settings.localUsage.byDay,
          [getLocalDateKey()]: message.todaySeconds
        },
        byMonth: {
          ...settings.localUsage.byMonth,
          [getLocalMonthKey()]: message.monthSeconds
        }
      }
    }));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSessionStatus(value: unknown): value is SessionStatus {
  return (
    value === "idle" ||
    value === "preparing" ||
    value === "capturing" ||
    value === "connecting" ||
    value === "connected" ||
    value === "stopping" ||
    value === "stopped" ||
    value === "error"
  );
}

function isUsageTickMessage(
  message: Record<string, unknown>
): message is Extract<ExtensionMessage, { type: "USAGE_TICK" }> {
  return (
    message.type === "USAGE_TICK" &&
    typeof message.elapsedSeconds === "number" &&
    typeof message.todaySeconds === "number" &&
    typeof message.monthSeconds === "number" &&
    typeof message.totalSeconds === "number" &&
    typeof message.estimatedCostUsd === "number"
  );
}

type RouteResult = {
  ok: boolean;
  statusMessage?: Extract<ExtensionMessage, { type: "SESSION_STATUS" }>;
};

function isRouteResult(value: unknown): value is RouteResult {
  return (
    isRecord(value) &&
    value.ok === true &&
    (value.statusMessage === undefined ||
      (isRecord(value.statusMessage) && isSessionStatus(value.statusMessage.status)))
  );
}

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Popup root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary title="Popupを表示できません">
      <PopupApp />
    </ErrorBoundary>
  </StrictMode>
);

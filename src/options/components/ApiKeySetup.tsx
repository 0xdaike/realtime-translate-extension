import { useState } from "react";
import type { TranslationProvider } from "../../lib/constants/providers";
import { ExtensionError } from "../../lib/errors/errors";
import { getUserFacingErrorMessage } from "../../lib/errors/userFacingMessages";
import { createApiKeyHint } from "../../security/encryptedLocalKeyStore";
import { ChromeKeyVault } from "../../security/keyVault";
import type { KeyStorageMode } from "../../security/keyStorageMode";
import { redactError } from "../../security/redaction";

type ApiKeySetupProps = {
  provider: TranslationProvider;
  mode: KeyStorageMode;
  keyVault: ChromeKeyVault;
  onKeyChanged: () => Promise<void>;
};

export function ApiKeySetup({ provider, mode, keyVault, onKeyChanged }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [keyHint, setKeyHint] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState("APIキーはまだ保存されていません。");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);
  const providerLabel = provider === "soniox" ? "Soniox" : "OpenAI";

  async function saveKey(): Promise<void> {
    setIsBusy(true);
    setErrorMessage(undefined);
    const trimmedApiKey = apiKey.trim();

    try {
      if (mode === "session_only") {
        await keyVault.storeSessionKey(trimmedApiKey);
      } else {
        await keyVault.storeEncryptedKey(trimmedApiKey, passphrase);
      }

      setKeyHint(createApiKeyHint(trimmedApiKey));
      setApiKey("");
      setPassphrase("");
      setStatusMessage("APIキーを保存しました。入力欄からは削除済みです。");
      await onKeyChanged();
    } catch (error) {
      setErrorMessage(toUserFacingError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function unlockKey(): Promise<void> {
    setIsBusy(true);
    setErrorMessage(undefined);

    try {
      await keyVault.unlock(mode === "encrypted_local" ? unlockPassphrase : undefined);
      setUnlockPassphrase("");
      setStatusMessage("APIキーのロックを解除しました。");
      await onKeyChanged();
    } catch (error) {
      setErrorMessage(toUserFacingError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function lockKey(): Promise<void> {
    setIsBusy(true);
    setErrorMessage(undefined);

    try {
      await keyVault.lock();
      setStatusMessage("セッション内のAPIキーをロックしました。");
      await onKeyChanged();
    } catch (error) {
      setErrorMessage(toUserFacingError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteKey(): Promise<void> {
    setIsBusy(true);
    setErrorMessage(undefined);

    try {
      await keyVault.deleteKey();
      setApiKey("");
      setPassphrase("");
      setUnlockPassphrase("");
      setKeyHint(undefined);
      setStatusMessage("APIキー情報を削除しました。");
      await onKeyChanged();
    } catch (error) {
      setErrorMessage(toUserFacingError(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">API Key</p>
        <h2>{providerLabel} APIキー</h2>
        <p className="muted">
          選択中の翻訳エンジン専用のキーとして保存します。別Providerのキーとは分離されます。
        </p>
      </div>

      <label className="field">
        <span>{providerLabel} APIキー</span>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          disabled={isBusy}
          placeholder={provider === "soniox" ? "Soniox API key" : "sk-..."}
          onChange={(event) => setApiKey(event.currentTarget.value)}
        />
      </label>

      {mode === "encrypted_local" ? (
        <label className="field">
          <span>保存用パスフレーズ</span>
          <input
            type="password"
            autoComplete="new-password"
            value={passphrase}
            disabled={isBusy}
            onChange={(event) => setPassphrase(event.currentTarget.value)}
          />
        </label>
      ) : null}

      <div className="button-row">
        <button type="button" disabled={isBusy || apiKey.trim() === ""} onClick={saveKey}>
          保存
        </button>
        <button type="button" className="secondary" disabled={isBusy} onClick={lockKey}>
          ロック
        </button>
        <button type="button" className="danger" disabled={isBusy} onClick={deleteKey}>
          削除
        </button>
      </div>

      {mode === "encrypted_local" ? (
        <div className="unlock-box">
          <label className="field">
            <span>ロック解除パスフレーズ</span>
            <input
              type="password"
              autoComplete="current-password"
              value={unlockPassphrase}
              disabled={isBusy}
              onChange={(event) => setUnlockPassphrase(event.currentTarget.value)}
            />
          </label>
          <button type="button" className="secondary" disabled={isBusy} onClick={unlockKey}>
            ロック解除
          </button>
        </div>
      ) : null}

      <p className="status-line">{keyHint === undefined ? statusMessage : `${statusMessage} (${keyHint})`}</p>
      {errorMessage === undefined ? null : <p className="error-line">{errorMessage}</p>}
    </section>
  );
}

function toUserFacingError(error: unknown): string {
  if (error instanceof ExtensionError) {
    return getUserFacingErrorMessage(error.code, error.message);
  }

  return getUserFacingErrorMessage("UNKNOWN_ERROR", redactError(error));
}

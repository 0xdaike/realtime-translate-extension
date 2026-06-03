import { ExtensionError } from "../lib/errors/errors";
import {
  DEFAULT_TRANSLATION_PROVIDER,
  type TranslationProvider
} from "../lib/constants/providers";
import { EncryptedLocalKeyStore } from "./encryptedLocalKeyStore";
import {
  isKeyStorageMode,
  type KeyStorageMode
} from "./keyStorageMode";
import { SessionKeyStore } from "./sessionKeyStore";
import {
  getStorageValue,
  setStorageValue,
  type TrustedStorageArea
} from "./storageArea";

export const KEY_STORAGE_MODE_STORAGE_KEY = "keyStorageMode";
export const DEFAULT_KEY_STORAGE_MODE: KeyStorageMode = "session_only";
export type KeyAvailability = "available" | "locked" | "missing";

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

export class ChromeKeyVault implements KeyVault {
  private readonly sessionKeyStore: SessionKeyStore;
  private readonly encryptedLocalKeyStore: EncryptedLocalKeyStore;
  private readonly modeStorageKey: string;

  constructor(
    private readonly localStorageArea: TrustedStorageArea = chrome.storage.local as TrustedStorageArea,
    sessionStorageArea: TrustedStorageArea = chrome.storage.session as TrustedStorageArea,
    provider: TranslationProvider = DEFAULT_TRANSLATION_PROVIDER
  ) {
    const storageKeys = getApiKeyStorageKeys(provider);
    this.modeStorageKey = storageKeys.mode;
    this.sessionKeyStore = new SessionKeyStore(sessionStorageArea, storageKeys.session);
    this.encryptedLocalKeyStore = new EncryptedLocalKeyStore(
      localStorageArea,
      this.sessionKeyStore,
      storageKeys.encrypted
    );
  }

  async getMode(): Promise<KeyStorageMode> {
    const mode = await getStorageValue<unknown>(this.localStorageArea, this.modeStorageKey);

    if (!isKeyStorageMode(mode)) {
      return DEFAULT_KEY_STORAGE_MODE;
    }

    return mode;
  }

  async setMode(mode: KeyStorageMode): Promise<void> {
    await setStorageValue(this.localStorageArea, this.modeStorageKey, mode);
  }

  async hasKey(): Promise<boolean> {
    return (await this.getKeyAvailability()) !== "missing";
  }

  async getKeyAvailability(): Promise<KeyAvailability> {
    const mode = await this.getMode();
    const hasSessionKey = await this.sessionKeyStore.hasKey();

    if (hasSessionKey) {
      return "available";
    }

    if (mode === "session_only") {
      return "missing";
    }

    if (mode === "encrypted_local") {
      return (await this.encryptedLocalKeyStore.hasEncryptedKey()) ? "locked" : "missing";
    }

    return "missing";
  }

  async storeSessionKey(apiKey: string): Promise<void> {
    await Promise.all([this.setMode("session_only"), this.sessionKeyStore.store(apiKey)]);
  }

  async storeEncryptedKey(apiKey: string, passphrase: string): Promise<void> {
    await this.encryptedLocalKeyStore.store(apiKey, passphrase);
    await this.setMode("encrypted_local");
  }

  async unlock(passphrase?: string): Promise<void> {
    const mode = await this.getMode();

    if (mode === "session_only") {
      await this.sessionKeyStore.require();
      return;
    }

    if (mode === "encrypted_local") {
      if (passphrase === undefined || passphrase === "") {
        throw new ExtensionError("API_KEY_LOCKED");
      }

      await this.encryptedLocalKeyStore.unlock(passphrase);
      return;
    }

    throw new ExtensionError("API_KEY_MISSING", "local_broker is not implemented.");
  }

  async getApiKeyForTrustedContext(): Promise<string> {
    const apiKey = await this.sessionKeyStore.get();

    if (apiKey !== undefined) {
      return apiKey;
    }

    const mode = await this.getMode();

    if (mode === "encrypted_local" && (await this.encryptedLocalKeyStore.hasEncryptedKey())) {
      throw new ExtensionError("API_KEY_LOCKED");
    }

    throw new ExtensionError("API_KEY_MISSING");
  }

  async lock(): Promise<void> {
    await this.sessionKeyStore.delete();
  }

  async deleteKey(): Promise<void> {
    await this.encryptedLocalKeyStore.delete();
  }
}

function getApiKeyStorageKeys(provider: TranslationProvider): {
  mode: string;
  session: string;
  encrypted: string;
} {
  if (provider === "openai") {
    return {
      mode: KEY_STORAGE_MODE_STORAGE_KEY,
      session: "openaiApiKey",
      encrypted: "encryptedOpenAiApiKey"
    };
  }

  return {
    mode: `${provider}KeyStorageMode`,
    session: `${provider}ApiKey`,
    encrypted: `encrypted${capitalize(provider)}ApiKey`
  };
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

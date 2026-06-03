import { ExtensionError } from "../lib/errors/errors";
import {
  decryptApiKey,
  encryptApiKey,
  type EncryptApiKeyOptions,
  type EncryptedApiKeyPayload
} from "./passphraseCrypto";
import { SessionKeyStore } from "./sessionKeyStore";
import {
  getStorageValue,
  removeStorageValue,
  setStorageValue,
  type TrustedStorageArea
} from "./storageArea";

export const ENCRYPTED_API_KEY_STORAGE_KEY = "encryptedOpenAiApiKey";

export type EncryptedApiKeyRecord = EncryptedApiKeyPayload & {
  keyHint: string;
  createdAt: string;
};

export class EncryptedLocalKeyStore {
  constructor(
    private readonly localStorageArea: TrustedStorageArea = chrome.storage.local as TrustedStorageArea,
    private readonly sessionKeyStore = new SessionKeyStore(),
    private readonly storageKey = ENCRYPTED_API_KEY_STORAGE_KEY
  ) {}

  async store(
    apiKey: string,
    passphrase: string,
    options: EncryptApiKeyOptions = {}
  ): Promise<EncryptedApiKeyRecord> {
    const normalizedApiKey = normalizeApiKey(apiKey);
    const payload = await encryptApiKey(normalizedApiKey, passphrase, options);
    const record: EncryptedApiKeyRecord = {
      ...payload,
      keyHint: createApiKeyHint(normalizedApiKey),
      createdAt: (options.now ?? new Date()).toISOString()
    };

    await setStorageValue(this.localStorageArea, this.storageKey, record);
    await this.sessionKeyStore.store(normalizedApiKey);

    return record;
  }

  async getRecord(): Promise<EncryptedApiKeyRecord | undefined> {
    const record = await getStorageValue<unknown>(
      this.localStorageArea,
      this.storageKey
    );

    if (!isEncryptedApiKeyRecord(record)) {
      return undefined;
    }

    return record;
  }

  async hasEncryptedKey(): Promise<boolean> {
    return (await this.getRecord()) !== undefined;
  }

  async unlock(passphrase: string): Promise<void> {
    const record = await this.getRecord();

    if (record === undefined) {
      throw new ExtensionError("API_KEY_MISSING");
    }

    const apiKey = await decryptApiKey(record, passphrase);
    await this.sessionKeyStore.store(apiKey);
  }

  async delete(): Promise<void> {
    await Promise.all([
      removeStorageValue(this.localStorageArea, this.storageKey),
      this.sessionKeyStore.delete()
    ]);
  }
}

export function createApiKeyHint(apiKey: string): string {
  const normalizedApiKey = normalizeApiKey(apiKey);
  const suffix = normalizedApiKey.slice(-4);

  if (normalizedApiKey.startsWith("sk-")) {
    return `sk-...${suffix}`;
  }

  return `...${suffix}`;
}

function normalizeApiKey(apiKey: string): string {
  const normalizedApiKey = apiKey.trim();

  if (normalizedApiKey === "") {
    throw new ExtensionError("API_KEY_MISSING");
  }

  return normalizedApiKey;
}

function isEncryptedApiKeyRecord(value: unknown): value is EncryptedApiKeyRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<EncryptedApiKeyRecord>;

  return (
    record.version === 1 &&
    record.kdf === "PBKDF2-SHA256" &&
    typeof record.iterations === "number" &&
    typeof record.saltBase64 === "string" &&
    typeof record.ivBase64 === "string" &&
    typeof record.ciphertextBase64 === "string" &&
    typeof record.keyHint === "string" &&
    typeof record.createdAt === "string"
  );
}

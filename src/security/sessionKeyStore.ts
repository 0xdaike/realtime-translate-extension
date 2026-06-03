import { ExtensionError } from "../lib/errors/errors";
import {
  getStorageValue,
  removeStorageValue,
  setStorageValue,
  type TrustedStorageArea
} from "./storageArea";

export const SESSION_API_KEY_STORAGE_KEY = "openaiApiKey";

export class SessionKeyStore {
  constructor(
    private readonly storageArea: TrustedStorageArea = chrome.storage.session as TrustedStorageArea,
    private readonly storageKey = SESSION_API_KEY_STORAGE_KEY
  ) {}

  async store(apiKey: string): Promise<void> {
    const normalizedApiKey = normalizeApiKey(apiKey);
    await setStorageValue(this.storageArea, this.storageKey, normalizedApiKey);
  }

  async get(): Promise<string | undefined> {
    const apiKey = await getStorageValue<unknown>(this.storageArea, this.storageKey);

    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      return undefined;
    }

    return apiKey;
  }

  async require(): Promise<string> {
    const apiKey = await this.get();

    if (apiKey === undefined) {
      throw new ExtensionError("API_KEY_MISSING");
    }

    return apiKey;
  }

  async hasKey(): Promise<boolean> {
    return (await this.get()) !== undefined;
  }

  async delete(): Promise<void> {
    await removeStorageValue(this.storageArea, this.storageKey);
  }
}

function normalizeApiKey(apiKey: string): string {
  const normalizedApiKey = apiKey.trim();

  if (normalizedApiKey === "") {
    throw new ExtensionError("API_KEY_MISSING");
  }

  return normalizedApiKey;
}

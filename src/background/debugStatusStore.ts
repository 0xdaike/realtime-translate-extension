import type { TrustedStorageArea } from "../security/storageArea";
import {
  getStorageValue,
  removeStorageValue,
  setStorageValue
} from "../security/storageArea";
import type { ExtensionMessage } from "../types/messages";

export const LAST_STATUS_STORAGE_KEY = "lastSessionStatus";
export const LAST_ERROR_STATUS_STORAGE_KEY = "lastSessionErrorStatus";

type StatusMessage = Extract<ExtensionMessage, { type: "SESSION_STATUS" }>;

export class DebugStatusStore {
  constructor(
    private readonly storageArea: TrustedStorageArea = chrome.storage.session as TrustedStorageArea
  ) {}

  async save(message: StatusMessage): Promise<void> {
    await setStorageValue(this.storageArea, LAST_STATUS_STORAGE_KEY, {
      ...message,
      recordedAt: new Date().toISOString()
    });

    if (message.status === "preparing" || message.status === "connected") {
      await removeStorageValue(this.storageArea, LAST_ERROR_STATUS_STORAGE_KEY);
      return;
    }

    if (message.status === "error") {
      await setStorageValue(this.storageArea, LAST_ERROR_STATUS_STORAGE_KEY, {
        ...message,
        recordedAt: new Date().toISOString()
      });
    }
  }

  async getLastStatus(): Promise<StatusMessage | undefined> {
    const value = await getStorageValue<unknown>(this.storageArea, LAST_STATUS_STORAGE_KEY);

    if (!isStatusRecord(value)) {
      return undefined;
    }

    return {
      type: "SESSION_STATUS",
      status: value.status,
      errorCode: value.errorCode,
      errorMessage: value.errorMessage
    };
  }

  async getLastErrorStatus(): Promise<StatusMessage | undefined> {
    const value = await getStorageValue<unknown>(this.storageArea, LAST_ERROR_STATUS_STORAGE_KEY);

    if (!isStatusRecord(value) || value.status !== "error") {
      return undefined;
    }

    return {
      type: "SESSION_STATUS",
      status: "error",
      errorCode: value.errorCode,
      errorMessage: value.errorMessage
    };
  }
}

function isStatusRecord(value: unknown): value is StatusMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<StatusMessage>;
  return record.type === "SESSION_STATUS" && typeof record.status === "string";
}

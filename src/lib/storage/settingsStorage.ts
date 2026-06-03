import {
  DEFAULT_TARGET_LANGUAGE,
  isTargetLanguage
} from "../constants/languages";
import {
  DEFAULT_TRANSLATION_PROVIDER,
  isTranslationProvider
} from "../constants/providers";
import {
  DEFAULT_SERVICE_MODE,
  isServiceMode
} from "../constants/serviceModes";
import type { UserSettings } from "../../types/settings";
import { isKeyStorageMode } from "../../security/keyStorageMode";
import {
  getStorageValue,
  setStorageValue,
  type TrustedStorageArea
} from "../../security/storageArea";

export const USER_SETTINGS_STORAGE_KEY = "userSettings";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  serviceMode: DEFAULT_SERVICE_MODE,
  translationProvider: DEFAULT_TRANSLATION_PROVIDER,
  keyStorageMode: "session_only",
  defaultTargetLanguage: DEFAULT_TARGET_LANGUAGE,
  subtitleEnabled: true,
  showSourceTranscript: false,
  originalVolume: 1,
  translationVolume: 1,
  muteOriginalOnStart: false,
  autoStopOnTabClose: true,
  localUsage: {
    totalSeconds: 0,
    byDay: {},
    byMonth: {}
  }
};

export async function loadUserSettings(
  storageArea: TrustedStorageArea = chrome.storage.local as TrustedStorageArea
): Promise<UserSettings> {
  const storedSettings = await getStorageValue<unknown>(storageArea, USER_SETTINGS_STORAGE_KEY);
  return normalizeUserSettings(storedSettings);
}

export async function saveUserSettings(
  settings: UserSettings,
  storageArea: TrustedStorageArea = chrome.storage.local as TrustedStorageArea
): Promise<void> {
  await setStorageValue(storageArea, USER_SETTINGS_STORAGE_KEY, normalizeUserSettings(settings));
}

export function normalizeUserSettings(value: unknown): UserSettings {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_USER_SETTINGS;
  }

  const partial = value as Partial<UserSettings>;

  return {
    serviceMode: isServiceMode(partial.serviceMode)
      ? partial.serviceMode
      : DEFAULT_USER_SETTINGS.serviceMode,
    translationProvider: isTranslationProvider(partial.translationProvider)
      ? partial.translationProvider
      : DEFAULT_USER_SETTINGS.translationProvider,
    keyStorageMode: isKeyStorageMode(partial.keyStorageMode)
      ? partial.keyStorageMode
      : DEFAULT_USER_SETTINGS.keyStorageMode,
    defaultTargetLanguage: isTargetLanguage(partial.defaultTargetLanguage)
      ? partial.defaultTargetLanguage
      : DEFAULT_USER_SETTINGS.defaultTargetLanguage,
    subtitleEnabled: coerceBoolean(
      partial.subtitleEnabled,
      DEFAULT_USER_SETTINGS.subtitleEnabled
    ),
    showSourceTranscript: coerceBoolean(
      partial.showSourceTranscript,
      DEFAULT_USER_SETTINGS.showSourceTranscript
    ),
    originalVolume: normalizeVolume(partial.originalVolume, DEFAULT_USER_SETTINGS.originalVolume),
    translationVolume: normalizeVolume(
      partial.translationVolume,
      DEFAULT_USER_SETTINGS.translationVolume
    ),
    muteOriginalOnStart: coerceBoolean(
      partial.muteOriginalOnStart,
      DEFAULT_USER_SETTINGS.muteOriginalOnStart
    ),
    autoStopOnTabClose: coerceBoolean(
      partial.autoStopOnTabClose,
      DEFAULT_USER_SETTINGS.autoStopOnTabClose
    ),
    localUsage: normalizeLocalUsage(partial.localUsage)
  };
}

function normalizeVolume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeLocalUsage(value: unknown): UserSettings["localUsage"] {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_USER_SETTINGS.localUsage;
  }

  const localUsage = value as Partial<UserSettings["localUsage"]>;

  return {
    totalSeconds:
      typeof localUsage.totalSeconds === "number" && localUsage.totalSeconds >= 0
        ? localUsage.totalSeconds
        : 0,
    byDay: normalizeNumberRecord(localUsage.byDay),
    byMonth: normalizeNumberRecord(localUsage.byMonth)
  };
}

function normalizeNumberRecord(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const result: Record<string, number> = {};

  for (const [key, recordValue] of Object.entries(value)) {
    if (typeof recordValue === "number" && Number.isFinite(recordValue) && recordValue >= 0) {
      result[key] = recordValue;
    }
  }

  return result;
}

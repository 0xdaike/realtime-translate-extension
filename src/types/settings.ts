import type { TargetLanguage } from "../lib/constants/languages";
import type { TranslationProvider } from "../lib/constants/providers";
import type { ServiceMode } from "../lib/constants/serviceModes";
import type { KeyStorageMode } from "../security/keyStorageMode";

export type UserSettings = {
  serviceMode: ServiceMode;
  translationProvider: TranslationProvider;
  keyStorageMode: KeyStorageMode;
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

import type { TargetLanguage } from "../lib/constants/languages";
import type { TranslationProvider } from "../lib/constants/providers";
import type { ServiceMode } from "../lib/constants/serviceModes";
import type { ErrorCode } from "../lib/errors/errors";

export type OffscreenProvider = TranslationProvider | "managed";

export type SessionStatus =
  | "idle"
  | "preparing"
  | "capturing"
  | "connecting"
  | "connected"
  | "stopping"
  | "stopped"
  | "error";

export type StopReason = "user" | "tab_closed" | "error";

export type TranscriptType = "source" | "translation";

export type ExtensionMessage =
  | {
      type: "POPUP_GET_STATUS";
    }
  | {
      type: "POPUP_GET_LAST_STATUS";
    }
  | {
      type: "POPUP_START_TRANSLATION";
      serviceMode: ServiceMode;
      provider: TranslationProvider;
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
      provider: "openai";
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
      type: "OFFSCREEN_START";
      provider: "managed";
      tabId: number;
      streamId: string;
      sessionUrl: string;
      sessionToken: string;
      realtimeOrigin: string;
      managedProvider: TranslationProvider;
      targetLanguage: TargetLanguage;
      originalVolume: number;
      translationVolume: number;
      subtitleEnabled: boolean;
      showSourceTranscript: boolean;
    }
  | {
      type: "OFFSCREEN_START";
      provider: "soniox";
      tabId: number;
      streamId: string;
      temporaryApiKey: string;
      targetLanguage: TargetLanguage;
      originalVolume: number;
      translationVolume: number;
      subtitleEnabled: boolean;
      showSourceTranscript: boolean;
    }
  | {
      type: "OFFSCREEN_STOP";
      reason: StopReason;
    }
  | {
      type: "SESSION_STATUS";
      status: SessionStatus;
      errorCode?: ErrorCode;
      errorMessage?: string;
    }
  | {
      type: "TRANSCRIPT_DELTA";
      transcriptType: TranscriptType;
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
      todaySeconds: number;
      monthSeconds: number;
      totalSeconds: number;
      estimatedCostUsd: number;
    };

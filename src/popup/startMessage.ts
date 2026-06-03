import type { ExtensionMessage } from "../types/messages";
import type { UserSettings } from "../types/settings";

type PopupStartMessage = Extract<ExtensionMessage, { type: "POPUP_START_TRANSLATION" }>;

export function createPopupStartMessage(settings: UserSettings): PopupStartMessage {
  return {
    type: "POPUP_START_TRANSLATION",
    serviceMode: settings.serviceMode,
    provider: settings.translationProvider,
    targetLanguage: settings.defaultTargetLanguage,
    originalVolume: settings.muteOriginalOnStart ? 0 : settings.originalVolume,
    translationVolume: settings.translationVolume,
    subtitleEnabled: settings.translationProvider === "soniox" ? true : settings.subtitleEnabled,
    showSourceTranscript: settings.showSourceTranscript
  };
}

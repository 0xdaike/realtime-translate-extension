import type { ExtensionMessage, SessionStatus, TranscriptType } from "../types/messages";
import { isOverlayTargetLanguage } from "./overlayLanguages";
import { SubtitleOverlay } from "./subtitleOverlay";

type RuntimeMessageApi = {
  onMessage: {
    addListener(listener: (message: unknown) => boolean | void): void;
  };
};

let overlay: SubtitleOverlay | undefined;

export function registerContentMessageHandler(
  runtimeApi: RuntimeMessageApi = chrome.runtime
): void {
  runtimeApi.onMessage.addListener((message: unknown) => {
    handleContentMessage(message);
    return false;
  });
}

export function handleContentMessage(message: unknown): void {
  const extensionMessage = parseContentMessage(message);

  if (extensionMessage === undefined) {
    return;
  }

  switch (extensionMessage.type) {
    case "OVERLAY_INIT":
      overlay = new SubtitleOverlay({
        targetLanguage: extensionMessage.targetLanguage,
        showSourceTranscript: extensionMessage.showSourceTranscript
      });
      return;
    case "OVERLAY_REMOVE":
      overlay?.remove();
      overlay = undefined;
      return;
    case "SESSION_STATUS":
      overlay?.updateStatus(extensionMessage.status, extensionMessage.errorMessage);
      return;
    case "TRANSCRIPT_DELTA":
      overlay?.appendTranscript(extensionMessage);
      return;
  }
}

function parseContentMessage(message: unknown): ContentMessage | undefined {
  if (!isRecord(message) || typeof message.type !== "string") {
    return undefined;
  }

  switch (message.type) {
    case "OVERLAY_INIT":
      if (isOverlayTargetLanguage(message.targetLanguage) && typeof message.showSourceTranscript === "boolean") {
        return message as Extract<ExtensionMessage, { type: "OVERLAY_INIT" }>;
      }
      return undefined;
    case "OVERLAY_REMOVE":
      return { type: "OVERLAY_REMOVE" };
    case "SESSION_STATUS":
      if (isSessionStatus(message.status)) {
        return message as Extract<ExtensionMessage, { type: "SESSION_STATUS" }>;
      }
      return undefined;
    case "TRANSCRIPT_DELTA":
      if (
        isTranscriptType(message.transcriptType) &&
        typeof message.delta === "string" &&
        (message.final === undefined || typeof message.final === "boolean")
      ) {
        return message as Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>;
      }
      return undefined;
    default:
      return undefined;
  }
}

type ContentMessage =
  | Extract<ExtensionMessage, { type: "OVERLAY_INIT" }>
  | Extract<ExtensionMessage, { type: "OVERLAY_REMOVE" }>
  | Extract<ExtensionMessage, { type: "SESSION_STATUS" }>
  | Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>;

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

function isTranscriptType(value: unknown): value is TranscriptType {
  return value === "source" || value === "translation";
}

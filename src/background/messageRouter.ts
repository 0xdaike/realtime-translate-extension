import { ExtensionError, isErrorCode } from "../lib/errors/errors";
import { isTargetLanguage } from "../lib/constants/languages";
import { isTranslationProvider } from "../lib/constants/providers";
import { isServiceMode } from "../lib/constants/serviceModes";
import { redactError } from "../security/redaction";
import type { ExtensionMessage } from "../types/messages";

export type RouteResult = {
  ok: boolean;
  error?: string;
  statusMessage?: Extract<ExtensionMessage, { type: "SESSION_STATUS" }>;
};
type RoutedSessionStatus = Extract<ExtensionMessage, { type: "SESSION_STATUS" }>["status"];

export type MessageRouterHandlers = {
  getSessionStatus(): Promise<Extract<ExtensionMessage, { type: "SESSION_STATUS" }>>;
  getLastSessionStatus(): Promise<Extract<ExtensionMessage, { type: "SESSION_STATUS" }> | undefined>;
  startTranslation(message: Extract<ExtensionMessage, { type: "POPUP_START_TRANSLATION" }>): Promise<void>;
  stopTranslation(message: Extract<ExtensionMessage, { type: "POPUP_STOP_TRANSLATION" }>): Promise<void>;
  updateVolume(message: Extract<ExtensionMessage, { type: "VOLUME_UPDATE" }>): Promise<void>;
  handleOffscreenStatus(message: Extract<ExtensionMessage, { type: "SESSION_STATUS" }>): Promise<void>;
  handleTranscriptDelta(message: Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>): Promise<void>;
};

export function registerMessageRouter(handlers: MessageRouterHandlers): void {
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    void routeExtensionMessage(message, handlers, sender).then(sendResponse);
    return true;
  });
}

export async function routeExtensionMessage(
  message: unknown,
  handlers: MessageRouterHandlers,
  sender?: chrome.runtime.MessageSender
): Promise<RouteResult> {
  try {
    const extensionMessage = parseExtensionMessage(message);

    switch (extensionMessage.type) {
      case "POPUP_GET_STATUS":
        assertTrustedExtensionSender(sender);
        return {
          ok: true,
          statusMessage: await handlers.getSessionStatus()
        };
      case "POPUP_GET_LAST_STATUS":
        assertTrustedExtensionSender(sender);
        return {
          ok: true,
          statusMessage: await handlers.getLastSessionStatus()
        };
      case "POPUP_START_TRANSLATION":
        assertTrustedExtensionSender(sender);
        await handlers.startTranslation(extensionMessage);
        return { ok: true };
      case "POPUP_STOP_TRANSLATION":
        assertTrustedExtensionSender(sender);
        await handlers.stopTranslation(extensionMessage);
        return { ok: true };
      case "VOLUME_UPDATE":
        assertTrustedExtensionSender(sender);
        await handlers.updateVolume(extensionMessage);
        return { ok: true };
      case "SESSION_STATUS":
        assertOffscreenSender(sender);
        await handlers.handleOffscreenStatus(extensionMessage);
        return { ok: true };
      case "TRANSCRIPT_DELTA":
        assertOffscreenSender(sender);
        await handlers.handleTranscriptDelta(extensionMessage);
        return { ok: true };
      case "OFFSCREEN_START":
      case "OFFSCREEN_STOP":
      case "OVERLAY_INIT":
      case "OVERLAY_REMOVE":
      case "USAGE_TICK":
        return { ok: true };
      default:
        return assertNever(extensionMessage);
    }
  } catch (error) {
    return {
      ok: false,
      error: redactError(error)
    };
  }
}

function parseExtensionMessage(message: unknown): ExtensionMessage {
  if (!isRecord(message) || typeof message.type !== "string") {
    throw new ExtensionError("UNKNOWN_ERROR", "Invalid extension message.");
  }

  switch (message.type) {
    case "POPUP_GET_STATUS":
      return { type: "POPUP_GET_STATUS" };
    case "POPUP_GET_LAST_STATUS":
      return { type: "POPUP_GET_LAST_STATUS" };
    case "POPUP_START_TRANSLATION":
      if (
        isTranslationProvider(message.provider) &&
        isServiceMode(message.serviceMode) &&
        isTargetLanguage(message.targetLanguage) &&
        isVolume(message.originalVolume) &&
        isVolume(message.translationVolume) &&
        typeof message.subtitleEnabled === "boolean" &&
        typeof message.showSourceTranscript === "boolean"
      ) {
        return message as Extract<ExtensionMessage, { type: "POPUP_START_TRANSLATION" }>;
      }
      break;
    case "POPUP_STOP_TRANSLATION":
      if (message.reason === "user") {
        return message as Extract<ExtensionMessage, { type: "POPUP_STOP_TRANSLATION" }>;
      }
      break;
    case "VOLUME_UPDATE":
      if (
        (message.originalVolume === undefined || isVolume(message.originalVolume)) &&
        (message.translationVolume === undefined || isVolume(message.translationVolume))
      ) {
        return message as Extract<ExtensionMessage, { type: "VOLUME_UPDATE" }>;
      }
      break;
    case "SESSION_STATUS":
      if (
        isSessionStatus(message.status) &&
        (message.errorCode === undefined || isErrorCode(message.errorCode)) &&
        (message.errorMessage === undefined || typeof message.errorMessage === "string")
      ) {
        return message as Extract<ExtensionMessage, { type: "SESSION_STATUS" }>;
      }
      break;
    case "TRANSCRIPT_DELTA":
      if (
        (message.transcriptType === "source" || message.transcriptType === "translation") &&
        typeof message.delta === "string" &&
        (message.final === undefined || typeof message.final === "boolean") &&
        (message.timestampMs === undefined ||
          (typeof message.timestampMs === "number" && Number.isFinite(message.timestampMs)))
      ) {
        return message as Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>;
      }
      break;
    case "OFFSCREEN_START":
    case "OFFSCREEN_STOP":
    case "OVERLAY_INIT":
    case "OVERLAY_REMOVE":
    case "USAGE_TICK":
      return message as ExtensionMessage;
  }

  throw new ExtensionError("UNKNOWN_ERROR", "Malformed extension message.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVolume(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isSessionStatus(value: unknown): value is RoutedSessionStatus {
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

function assertTrustedExtensionSender(sender: chrome.runtime.MessageSender | undefined): void {
  if (sender === undefined) {
    return;
  }

  if (sender.id === chrome.runtime.id && sender.tab === undefined) {
    return;
  }

  throw new ExtensionError("PERMISSION_FAILED", "Untrusted extension message source.");
}

function assertOffscreenSender(sender: chrome.runtime.MessageSender | undefined): void {
  if (sender === undefined) {
    return;
  }

  const senderUrl = sender.url ?? "";
  const expectedUrl = chrome.runtime.getURL("src/offscreen/offscreen.html");

  if (sender.id === chrome.runtime.id && sender.tab === undefined && senderUrl === expectedUrl) {
    return;
  }

  throw new ExtensionError("PERMISSION_FAILED", "Untrusted offscreen message source.");
}

function assertNever(value: never): never {
  throw new ExtensionError("UNKNOWN_ERROR", `Unhandled message: ${String(value)}`);
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  routeExtensionMessage,
  type MessageRouterHandlers
} from "../src/background/messageRouter";

function createHandlers(): MessageRouterHandlers {
  return {
    getSessionStatus: vi.fn(async () => ({
      type: "SESSION_STATUS",
      status: "idle"
    } as const)),
    getLastSessionStatus: vi.fn(async () => undefined),
    startTranslation: vi.fn(async () => undefined),
    stopTranslation: vi.fn(async () => undefined),
    updateVolume: vi.fn(async () => undefined),
    handleOffscreenStatus: vi.fn(async () => undefined),
    handleTranscriptDelta: vi.fn(async () => undefined)
  };
}

describe("message router", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the current status for popup status requests", async () => {
    const handlers = createHandlers();
    const result = await routeExtensionMessage(
      {
        type: "POPUP_GET_STATUS"
      },
      handlers
    );

    expect(result).toEqual({
      ok: true,
      statusMessage: {
        type: "SESSION_STATUS",
        status: "idle"
      }
    });
    expect(handlers.getSessionStatus).toHaveBeenCalledTimes(1);
  });

  it("returns the last status for popup diagnostics", async () => {
    const handlers = createHandlers();
    handlers.getLastSessionStatus = vi.fn(async () => ({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "WEBRTC_FAILED",
      errorMessage: "failed"
    } as const));

    const result = await routeExtensionMessage(
      {
        type: "POPUP_GET_LAST_STATUS"
      },
      handlers
    );

    expect(result).toEqual({
      ok: true,
      statusMessage: {
        type: "SESSION_STATUS",
        status: "error",
        errorCode: "WEBRTC_FAILED",
        errorMessage: "failed"
      }
    });
  });

  it("routes valid popup start messages", async () => {
    const handlers = createHandlers();
    const result = await routeExtensionMessage(
      {
        type: "POPUP_START_TRANSLATION",
        serviceMode: "byok",
        provider: "openai",
        targetLanguage: "ja",
        originalVolume: 0.8,
        translationVolume: 1,
        subtitleEnabled: true,
        showSourceTranscript: false
      },
      handlers
    );

    expect(result).toEqual({ ok: true });
    expect(handlers.startTranslation).toHaveBeenCalledTimes(1);
    expect(handlers.startTranslation).toHaveBeenCalledWith({
      type: "POPUP_START_TRANSLATION",
      serviceMode: "byok",
      provider: "openai",
      targetLanguage: "ja",
      originalVolume: 0.8,
      translationVolume: 1,
      subtitleEnabled: true,
      showSourceTranscript: false
    });
  });

  it("routes managed popup start messages", async () => {
    const handlers = createHandlers();
    const result = await routeExtensionMessage(
      {
        type: "POPUP_START_TRANSLATION",
        serviceMode: "managed",
        provider: "openai",
        targetLanguage: "ja",
        originalVolume: 0.8,
        translationVolume: 1,
        subtitleEnabled: true,
        showSourceTranscript: false
      },
      handlers
    );

    expect(result).toEqual({ ok: true });
    expect(handlers.startTranslation).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed start messages", async () => {
    const handlers = createHandlers();
    const result = await routeExtensionMessage(
      {
        type: "POPUP_START_TRANSLATION",
        serviceMode: "byok",
        provider: "openai",
        targetLanguage: "xx",
        originalVolume: 2,
        translationVolume: 1,
        subtitleEnabled: true,
        showSourceTranscript: false
      },
      handlers
    );

    expect(result.ok).toBe(false);
    expect(handlers.startTranslation).not.toHaveBeenCalled();
  });

  it("rejects unknown translation providers", async () => {
    const handlers = createHandlers();
    const result = await routeExtensionMessage(
      {
        type: "POPUP_START_TRANSLATION",
        serviceMode: "byok",
        provider: "unknown",
        targetLanguage: "ja",
        originalVolume: 0.8,
        translationVolume: 1,
        subtitleEnabled: true,
        showSourceTranscript: false
      },
      handlers
    );

    expect(result.ok).toBe(false);
    expect(handlers.startTranslation).not.toHaveBeenCalled();
  });

  it("rejects offscreen status messages from content scripts", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        id: "extension-id",
        getURL: (path: string) => `chrome-extension://extension-id/${path}`
      }
    });
    const handlers = createHandlers();
    const result = await routeExtensionMessage(
      {
        type: "SESSION_STATUS",
        status: "connected"
      },
      handlers,
      {
        id: "extension-id",
        tab: { id: 7 },
        url: "https://example.com/"
      } as chrome.runtime.MessageSender
    );

    expect(result).toEqual({
      ok: false,
      error: "Untrusted offscreen message source."
    });
    expect(handlers.handleOffscreenStatus).not.toHaveBeenCalled();
  });

  it("redacts handler errors", async () => {
    const handlers = createHandlers();
    const fakeApiKey = ["sk", "router-error-123456789"].join("-");
    handlers.updateVolume = vi.fn(async () => {
      throw new Error(`bad ${fakeApiKey}`);
    });

    const result = await routeExtensionMessage(
      {
        type: "VOLUME_UPDATE",
        originalVolume: 0.5
      },
      handlers
    );

    expect(result).toEqual({
      ok: false,
      error: "bad sk-REDACTED"
    });
  });
});

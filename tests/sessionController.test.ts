import { describe, expect, it, vi } from "vitest";
import { BackgroundSessionController } from "../src/background/sessionController";
import { SessionStateStore } from "../src/lib/state/sessionState";
import type { ExtensionMessage } from "../src/types/messages";

type StatusMessage = Extract<ExtensionMessage, { type: "SESSION_STATUS" }>;
type OffscreenStartMessage = Extract<ExtensionMessage, { type: "OFFSCREEN_START" }>;

const START_MESSAGE = {
  type: "POPUP_START_TRANSLATION",
  serviceMode: "byok",
  provider: "openai",
  targetLanguage: "ja",
  originalVolume: 0.5,
  translationVolume: 0.9,
  subtitleEnabled: true,
  showSourceTranscript: false
} as const;

describe("BackgroundSessionController", () => {
  it("creates client secret and sends only the client secret to offscreen", async () => {
    const published: StatusMessage[] = [];
    const offscreenStarts: OffscreenStartMessage[] = [];
    const contentScriptController = {
      injectOverlay: vi.fn(async () => undefined),
      initializeOverlay: vi.fn(async () => undefined),
      removeOverlay: vi.fn(async () => undefined),
      forwardStatus: vi.fn(async () => undefined),
      forwardTranscriptDelta: vi.fn(async () => undefined)
    };
    const usageController = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const apiKey = ["sk", "standard-key-123456789"].join("-");
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async (message) => {
        published.push(message);
      },
      {
        getActiveTabAudioStream: vi.fn(async () => ({
          tabId: 7,
          streamId: "stream-id"
        }))
      } as never,
      {
        sendStart: vi.fn(async (message: OffscreenStartMessage) => {
          offscreenStarts.push(message);
        }),
        sendStop: vi.fn(async () => undefined)
      } as never,
      {
        createClientSecret: vi.fn(async () => ({
          value: "ek_test_client_secret",
          expiresAt: 123
        }))
      } as never,
      contentScriptController as never,
      usageController as never
    );

    await controller.startTranslation(START_MESSAGE);

    expect(published.map((message) => message.status)).toEqual([
      "preparing",
      "capturing",
      "connecting"
    ]);
    expect(offscreenStarts).toEqual([
      {
        type: "OFFSCREEN_START",
        provider: "openai",
        tabId: 7,
        streamId: "stream-id",
        clientSecret: "ek_test_client_secret",
        targetLanguage: "ja",
        originalVolume: 0.5,
        translationVolume: 0.9,
        subtitleEnabled: true,
        showSourceTranscript: false
      }
    ]);
    expect(JSON.stringify(offscreenStarts)).not.toContain(apiKey);
    expect(contentScriptController.injectOverlay).toHaveBeenCalledWith(7);
    expect(contentScriptController.initializeOverlay).toHaveBeenCalledWith(7, {
      type: "OVERLAY_INIT",
      targetLanguage: "ja",
      showSourceTranscript: false
    });
    await controller.handleOffscreenStatus({
      type: "SESSION_STATUS",
      status: "connected"
    });
    expect(usageController.start).toHaveBeenCalledTimes(1);
    expect(controller.getCurrentStatus()).toMatchObject({
      type: "SESSION_STATUS",
      status: "connected"
    });
  });

  it("publishes a redacted error status when start fails", async () => {
    const published: StatusMessage[] = [];
    const leakedKey = ["sk", "failure-123456789"].join("-");
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async (message) => {
        published.push(message);
      },
      {
        getActiveTabAudioStream: vi.fn(async () => ({
          tabId: 7,
          streamId: "stream-id"
        }))
      } as never,
      {
        sendStart: vi.fn(async () => undefined),
        sendStop: vi.fn(async () => undefined)
      } as never,
      {
        createClientSecret: vi.fn(async () => {
          throw new Error(`bad ${leakedKey}`);
        })
      } as never
    );

    await controller.startTranslation(START_MESSAGE);

    expect(published.at(-1)).toMatchObject({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "UNKNOWN_ERROR",
      errorMessage: expect.stringContaining("sk-REDACTED")
    });
  });

  it("does not inject the subtitle overlay when subtitles are disabled", async () => {
    const contentScriptController = {
      injectOverlay: vi.fn(async () => undefined),
      initializeOverlay: vi.fn(async () => undefined),
      removeOverlay: vi.fn(async () => undefined),
      forwardStatus: vi.fn(async () => undefined),
      forwardTranscriptDelta: vi.fn(async () => undefined)
    };
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async () => undefined,
      {
        getActiveTabAudioStream: vi.fn(async () => ({
          tabId: 7,
          streamId: "stream-id"
        }))
      } as never,
      {
        sendStart: vi.fn(async () => undefined),
        sendStop: vi.fn(async () => undefined)
      } as never,
      {
        createClientSecret: vi.fn(async () => ({
          value: "ek_test_client_secret",
          expiresAt: 123
        }))
      } as never,
      contentScriptController as never
    );

    await controller.startTranslation({
      ...START_MESSAGE,
      subtitleEnabled: false
    });

    expect(contentScriptController.injectOverlay).not.toHaveBeenCalled();
    expect(contentScriptController.initializeOverlay).not.toHaveBeenCalled();
  });

  it("creates a Soniox temporary key and sends only that key to offscreen", async () => {
    const offscreenStarts: OffscreenStartMessage[] = [];
    const openAiClientSecretService = {
      createClientSecret: vi.fn()
    };
    const usageController = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const sonioxStandardKey = "soniox-standard-key-123456789";
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async () => undefined,
      {
        getActiveTabAudioStream: vi.fn(async () => ({
          tabId: 7,
          streamId: "stream-id"
        }))
      } as never,
      {
        sendStart: vi.fn(async (message: OffscreenStartMessage) => {
          offscreenStarts.push(message);
        }),
        sendStop: vi.fn(async () => undefined)
      } as never,
      openAiClientSecretService as never,
      {
        injectOverlay: vi.fn(async () => undefined),
        initializeOverlay: vi.fn(async () => undefined),
        removeOverlay: vi.fn(async () => undefined),
        forwardStatus: vi.fn(async () => undefined),
        forwardTranscriptDelta: vi.fn(async () => undefined)
      } as never,
      usageController as never,
      {
        createTemporaryKey: vi.fn(async () => ({
          value: "temp:soniox-temporary-key-123456789",
          expiresAt: "2026-05-18T00:01:00.000Z"
        }))
      } as never
    );

    await controller.startTranslation({
      ...START_MESSAGE,
      provider: "soniox"
    });

    expect(openAiClientSecretService.createClientSecret).not.toHaveBeenCalled();
    expect(offscreenStarts).toEqual([
      {
        type: "OFFSCREEN_START",
        provider: "soniox",
        tabId: 7,
        streamId: "stream-id",
        temporaryApiKey: "temp:soniox-temporary-key-123456789",
        targetLanguage: "ja",
        originalVolume: 0.5,
        translationVolume: 0.9,
        subtitleEnabled: true,
        showSourceTranscript: false
      }
    ]);
    expect(JSON.stringify(offscreenStarts)).not.toContain(sonioxStandardKey);

    await controller.handleOffscreenStatus({
      type: "SESSION_STATUS",
      status: "connected"
    });
    expect(usageController.start).toHaveBeenCalledWith("soniox");
  });

  it("creates a managed session without using BYOK credential services", async () => {
    const offscreenStarts: OffscreenStartMessage[] = [];
    const openAiClientSecretService = {
      createClientSecret: vi.fn()
    };
    const sonioxTemporaryKeyService = {
      createTemporaryKey: vi.fn()
    };
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async () => undefined,
      {
        getActiveTabAudioStream: vi.fn(async () => ({
          tabId: 7,
          streamId: "stream-id"
        }))
      } as never,
      {
        sendStart: vi.fn(async (message: OffscreenStartMessage) => {
          offscreenStarts.push(message);
        }),
        sendStop: vi.fn(async () => undefined)
      } as never,
      openAiClientSecretService as never,
      {
        injectOverlay: vi.fn(async () => undefined),
        initializeOverlay: vi.fn(async () => undefined),
        removeOverlay: vi.fn(async () => undefined),
        forwardStatus: vi.fn(async () => undefined),
        forwardTranscriptDelta: vi.fn(async () => undefined)
      } as never,
      undefined,
      sonioxTemporaryKeyService as never,
      {
        createSession: vi.fn(async () => ({
          sessionUrl: "wss://managed.example.test/realtime",
          sessionToken: "managed-session-token-123456789",
          expiresAt: "2026-05-18T00:01:00.000Z",
          realtimeOrigin: "wss://managed.example.test"
        }))
      } as never
    );

    await controller.startTranslation({
      ...START_MESSAGE,
      serviceMode: "managed",
      provider: "soniox",
      subtitleEnabled: false
    });

    expect(openAiClientSecretService.createClientSecret).not.toHaveBeenCalled();
    expect(sonioxTemporaryKeyService.createTemporaryKey).not.toHaveBeenCalled();
    expect(offscreenStarts).toEqual([
      {
        type: "OFFSCREEN_START",
        provider: "managed",
        managedProvider: "soniox",
        tabId: 7,
        streamId: "stream-id",
        sessionUrl: "wss://managed.example.test/realtime",
        sessionToken: "managed-session-token-123456789",
        realtimeOrigin: "wss://managed.example.test",
        targetLanguage: "ja",
        originalVolume: 0.5,
        translationVolume: 0.9,
        subtitleEnabled: true,
        showSourceTranscript: false
      }
    ]);
  });

  it("forwards transcript deltas only to the active tab overlay", async () => {
    const contentScriptController = {
      injectOverlay: vi.fn(async () => undefined),
      initializeOverlay: vi.fn(async () => undefined),
      removeOverlay: vi.fn(async () => undefined),
      forwardStatus: vi.fn(async () => undefined),
      forwardTranscriptDelta: vi.fn(async () => undefined)
    };
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async () => undefined,
      {
        getActiveTabAudioStream: vi.fn(async () => ({
          tabId: 7,
          streamId: "stream-id"
        }))
      } as never,
      {
        sendStart: vi.fn(async () => undefined),
        sendStop: vi.fn(async () => undefined)
      } as never,
      {
        createClientSecret: vi.fn(async () => ({
          value: "ek_test_client_secret",
          expiresAt: 123
        }))
      } as never,
      contentScriptController as never
    );

    await controller.forwardTranscriptDelta({
      type: "TRANSCRIPT_DELTA",
      transcriptType: "translation",
      delta: "ignored"
    });
    await controller.startTranslation(START_MESSAGE);
    await controller.forwardTranscriptDelta({
      type: "TRANSCRIPT_DELTA",
      transcriptType: "translation",
      delta: "こんにちは",
      final: true
    });

    expect(contentScriptController.forwardTranscriptDelta).toHaveBeenCalledTimes(1);
    expect(contentScriptController.forwardTranscriptDelta).toHaveBeenCalledWith(7, {
      type: "TRANSCRIPT_DELTA",
      transcriptType: "translation",
      delta: "こんにちは",
      final: true
    });
  });

  it("cleans up overlay and usage when start fails after tab capture", async () => {
    const contentScriptController = {
      injectOverlay: vi.fn(async () => undefined),
      initializeOverlay: vi.fn(async () => undefined),
      removeOverlay: vi.fn(async () => undefined),
      forwardStatus: vi.fn(async () => undefined),
      forwardTranscriptDelta: vi.fn(async () => undefined)
    };
    const usageController = {
      start: vi.fn(),
      stop: vi.fn()
    };
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async () => undefined,
      {
        getActiveTabAudioStream: vi.fn(async () => ({
          tabId: 7,
          streamId: "stream-id"
        }))
      } as never,
      {
        sendStart: vi.fn(async () => undefined),
        sendStop: vi.fn(async () => undefined)
      } as never,
      {
        createClientSecret: vi.fn(async () => {
          throw new Error("client secret failed");
        })
      } as never,
      contentScriptController as never,
      usageController as never
    );

    await controller.startTranslation(START_MESSAGE);

    expect(usageController.stop).toHaveBeenCalledTimes(1);
    expect(contentScriptController.removeOverlay).toHaveBeenCalledWith(7);
  });

  it("keeps an error status when offscreen cleanup later reports stopped", async () => {
    const published: StatusMessage[] = [];
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async (message) => {
        published.push(message);
      }
    );

    await controller.handleOffscreenStatus({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "WEBRTC_FAILED",
      errorMessage: "OpenAI returned 402"
    });
    await controller.handleOffscreenStatus({
      type: "SESSION_STATUS",
      status: "stopping"
    });
    await controller.handleOffscreenStatus({
      type: "SESSION_STATUS",
      status: "stopped"
    });

    expect(controller.getCurrentStatus()).toMatchObject({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "WEBRTC_FAILED"
    });
    expect(published.at(-1)).toMatchObject({
      type: "SESSION_STATUS",
      status: "error"
    });
  });

  it("closes the offscreen document after a user stop", async () => {
    const offscreenController = {
      sendStop: vi.fn(async () => undefined),
      closeDocument: vi.fn(async () => undefined)
    };
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async () => undefined,
      undefined,
      offscreenController as never
    );

    await controller.stopTranslation({
      type: "POPUP_STOP_TRANSLATION",
      reason: "user"
    });

    expect(offscreenController.sendStop).toHaveBeenCalledWith("user");
    expect(offscreenController.closeDocument).toHaveBeenCalledTimes(1);
  });

  it("treats an unexpected offscreen stopped status as an error", async () => {
    const published: StatusMessage[] = [];
    const controller = new BackgroundSessionController(
      new SessionStateStore(),
      async (message) => {
        published.push(message);
      },
      undefined,
      {
        sendStop: vi.fn(async () => undefined)
      } as never
    );

    await controller.handleOffscreenStatus({
      type: "SESSION_STATUS",
      status: "connected"
    });
    await controller.handleOffscreenStatus({
      type: "SESSION_STATUS",
      status: "stopped"
    });

    expect(controller.getCurrentStatus()).toMatchObject({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "UNKNOWN_ERROR",
      errorMessage: expect.stringContaining("Offscreen document stopped unexpectedly")
    });
    expect(published.at(-1)).toMatchObject({
      type: "SESSION_STATUS",
      status: "error"
    });
  });
});

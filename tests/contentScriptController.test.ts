import { describe, expect, it, vi } from "vitest";
import { ContentScriptController } from "../src/background/contentScriptController";

describe("ContentScriptController", () => {
  it("injects the bundled overlay content script into the active tab", async () => {
    const scriptingApi = {
      executeScript: vi.fn(async () => undefined)
    };
    const tabsApi = {
      sendMessage: vi.fn(async () => undefined)
    };
    const controller = new ContentScriptController(scriptingApi, tabsApi);

    await controller.injectOverlay(7);

    expect(scriptingApi.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ["src/content/overlay.js"]
    });
  });

  it("sends transcript deltas to the injected overlay", async () => {
    const scriptingApi = {
      executeScript: vi.fn(async () => undefined)
    };
    const tabsApi = {
      sendMessage: vi.fn(async () => undefined)
    };
    const controller = new ContentScriptController(scriptingApi, tabsApi);

    await controller.forwardTranscriptDelta(7, {
      type: "TRANSCRIPT_DELTA",
      transcriptType: "translation",
      delta: "こんにちは",
      final: true
    });

    expect(tabsApi.sendMessage).toHaveBeenCalledWith(7, {
      type: "TRANSCRIPT_DELTA",
      transcriptType: "translation",
      delta: "こんにちは",
      final: true
    });
  });
});

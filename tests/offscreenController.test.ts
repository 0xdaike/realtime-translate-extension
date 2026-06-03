import { describe, expect, it, vi } from "vitest";
import { OffscreenController } from "../src/background/offscreenController";

describe("OffscreenController", () => {
  it("creates the offscreen document when absent", async () => {
    const offscreenApi = {
      hasDocument: vi.fn(async () => false),
      createDocument: vi.fn(async () => undefined),
      closeDocument: vi.fn(async () => undefined)
    };
    const runtimeApi = {
      getURL: vi.fn((path: string) => `chrome-extension://id/${path}`),
      sendMessage: vi.fn(async () => undefined)
    };
    const controller = new OffscreenController(offscreenApi, runtimeApi);

    await controller.ensureDocument();

    expect(offscreenApi.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "chrome-extension://id/src/offscreen/offscreen.html",
        reasons: ["USER_MEDIA", "WEB_RTC", "AUDIO_PLAYBACK"]
      })
    );
  });

  it("uses runtime contexts when available to detect an existing offscreen document", async () => {
    const offscreenApi = {
      hasDocument: vi.fn(async () => false),
      createDocument: vi.fn(async () => undefined),
      closeDocument: vi.fn(async () => undefined)
    };
    const runtimeApi = {
      getURL: vi.fn((path: string) => `chrome-extension://id/${path}`),
      getContexts: vi.fn(async () => [{}]),
      sendMessage: vi.fn(async () => undefined)
    };
    const controller = new OffscreenController(offscreenApi, runtimeApi);

    await controller.ensureDocument();

    expect(runtimeApi.getContexts).toHaveBeenCalledWith({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: ["chrome-extension://id/src/offscreen/offscreen.html"]
    });
    expect(offscreenApi.hasDocument).not.toHaveBeenCalled();
    expect(offscreenApi.createDocument).not.toHaveBeenCalled();
  });

  it("does not recreate an existing offscreen document", async () => {
    const offscreenApi = {
      hasDocument: vi.fn(async () => true),
      createDocument: vi.fn(async () => undefined),
      closeDocument: vi.fn(async () => undefined)
    };
    const runtimeApi = {
      getURL: vi.fn((path: string) => path),
      sendMessage: vi.fn(async () => undefined)
    };
    const controller = new OffscreenController(offscreenApi, runtimeApi);

    await controller.ensureDocument();

    expect(offscreenApi.createDocument).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { TabCaptureController } from "../src/background/tabCaptureController";

describe("TabCaptureController", () => {
  it("returns active tab stream info", async () => {
    const tabsApi = {
      query: vi.fn(async () => [{ id: 42 }])
    };
    const tabCaptureApi = {
      getMediaStreamId: vi.fn(async () => "stream-id")
    };
    const controller = new TabCaptureController(tabsApi, tabCaptureApi);

    await expect(controller.getActiveTabAudioStream()).resolves.toEqual({
      tabId: 42,
      streamId: "stream-id"
    });
    expect(tabCaptureApi.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 42 });
  });

  it("fails when there is no active tab", async () => {
    const controller = new TabCaptureController(
      {
        query: vi.fn(async () => [])
      },
      {
        getMediaStreamId: vi.fn(async () => "stream-id")
      }
    );

    await expect(controller.getActiveTabAudioStream()).rejects.toMatchObject({
      code: "TAB_CAPTURE_FAILED"
    });
  });
});

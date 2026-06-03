import { describe, expect, it } from "vitest";
import { DEFAULT_USER_SETTINGS } from "../src/lib/storage/settingsStorage";
import { createPopupStartMessage } from "../src/popup/startMessage";

describe("createPopupStartMessage", () => {
  it("includes the configured translation provider", () => {
    expect(
      createPopupStartMessage({
        ...DEFAULT_USER_SETTINGS,
        translationProvider: "soniox"
      }).provider
    ).toBe("soniox");
  });

  it("includes the configured service mode", () => {
    expect(
      createPopupStartMessage({
        ...DEFAULT_USER_SETTINGS,
        serviceMode: "managed"
      }).serviceMode
    ).toBe("managed");
  });

  it("enables subtitles for Soniox because the first implementation is subtitle-only", () => {
    expect(
      createPopupStartMessage({
        ...DEFAULT_USER_SETTINGS,
        translationProvider: "soniox",
        subtitleEnabled: false
      }).subtitleEnabled
    ).toBe(true);
  });

  it("uses configured original volume when mute-on-start is disabled", () => {
    expect(
      createPopupStartMessage({
        ...DEFAULT_USER_SETTINGS,
        originalVolume: 0.4,
        muteOriginalOnStart: false
      }).originalVolume
    ).toBe(0.4);
  });

  it("starts with muted original audio when mute-on-start is enabled", () => {
    expect(
      createPopupStartMessage({
        ...DEFAULT_USER_SETTINGS,
        originalVolume: 0.4,
        muteOriginalOnStart: true
      }).originalVolume
    ).toBe(0);
  });
});

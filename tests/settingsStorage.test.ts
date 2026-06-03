import { describe, expect, it } from "vitest";
import {
  DEFAULT_USER_SETTINGS,
  normalizeUserSettings
} from "../src/lib/storage/settingsStorage";

describe("normalizeUserSettings", () => {
  it("keeps valid managed service mode", () => {
    expect(
      normalizeUserSettings({
        ...DEFAULT_USER_SETTINGS,
        serviceMode: "managed"
      }).serviceMode
    ).toBe("managed");
  });

  it("falls back to BYOK for unknown service modes", () => {
    expect(
      normalizeUserSettings({
        ...DEFAULT_USER_SETTINGS,
        serviceMode: "unknown"
      }).serviceMode
    ).toBe("byok");
  });
});

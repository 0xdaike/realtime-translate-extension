import { describe, expect, it } from "vitest";
import {
  addLocalUsageSeconds,
  getLocalDateKey,
  getLocalMonthKey
} from "../src/lib/usage/localUsageTimer";
import { DEFAULT_USER_SETTINGS } from "../src/lib/storage/settingsStorage";

describe("local usage timer", () => {
  it("adds usage seconds to total, day, and month buckets", () => {
    const now = new Date("2026-05-13T12:34:56+09:00");
    const settings = addLocalUsageSeconds(DEFAULT_USER_SETTINGS, 7, now);

    expect(settings.localUsage.totalSeconds).toBe(7);
    expect(settings.localUsage.byDay[getLocalDateKey(now)]).toBe(7);
    expect(settings.localUsage.byMonth[getLocalMonthKey(now)]).toBe(7);
  });

  it("ignores invalid non-positive increments", () => {
    const settings = addLocalUsageSeconds(DEFAULT_USER_SETTINGS, -3);

    expect(settings).toBe(DEFAULT_USER_SETTINGS);
  });
});

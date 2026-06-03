import { describe, expect, it, vi } from "vitest";
import { UsageController } from "../src/background/usageController";
import { SONIOX_REALTIME_TRANSLATE_USD_PER_MIN } from "../src/lib/usage/costEstimator";
import { USER_SETTINGS_STORAGE_KEY } from "../src/lib/storage/settingsStorage";
import type { TrustedStorageArea } from "../src/security/storageArea";
import type { ExtensionMessage } from "../src/types/messages";

type UsageTickMessage = Extract<ExtensionMessage, { type: "USAGE_TICK" }>;

describe("UsageController", () => {
  it("records one local usage second and publishes a usage tick", async () => {
    const stored: Record<string, unknown> = {};
    const storageArea: TrustedStorageArea = {
      get: vi.fn(async (key: string) => ({ [key]: stored[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(stored, items);
      }),
      remove: vi.fn(async () => undefined)
    };
    const published: UsageTickMessage[] = [];
    const controller = new UsageController(
      async (message) => {
        published.push(message);
      },
      storageArea
    );

    await controller.recordUsageSecond(new Date("2026-05-13T12:00:00+09:00"));

    expect(published).toEqual([
      {
        type: "USAGE_TICK",
        elapsedSeconds: 1,
        todaySeconds: 1,
        monthSeconds: 1,
        totalSeconds: 1,
        estimatedCostUsd: 0.034 / 60
      }
    ]);
    expect(JSON.stringify(stored[USER_SETTINGS_STORAGE_KEY])).toContain("\"totalSeconds\":1");
  });

  it("uses the active provider for realtime cost estimates", async () => {
    const stored: Record<string, unknown> = {};
    const storageArea: TrustedStorageArea = {
      get: vi.fn(async (key: string) => ({ [key]: stored[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(stored, items);
      }),
      remove: vi.fn(async () => undefined)
    };
    const published: UsageTickMessage[] = [];
    const controller = new UsageController(
      async (message) => {
        published.push(message);
      },
      storageArea
    );

    controller.start("soniox");
    controller.stop();
    await controller.recordUsageSecond(new Date("2026-05-13T12:00:00+09:00"));

    expect(published[0]?.estimatedCostUsd).toBe(SONIOX_REALTIME_TRANSLATE_USD_PER_MIN / 60);
  });
});

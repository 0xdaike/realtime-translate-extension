import { describe, expect, it } from "vitest";
import { ExtensionError } from "../src/lib/errors/errors";
import { SessionStateStore } from "../src/lib/state/sessionState";
import type { TrustedStorageArea } from "../src/security/storageArea";

describe("SessionStateStore", () => {
  it("starts from idle and enters preparing", () => {
    const store = new SessionStateStore();

    expect(store.getSnapshot().status).toBe("idle");
    expect(store.startPreparing(123)).toMatchObject({
      status: "preparing",
      activeTabId: 123
    });
  });

  it("prevents concurrent active sessions", () => {
    const store = new SessionStateStore();

    store.startPreparing(123);

    expect(() => store.startPreparing(456)).toThrow(ExtensionError);
  });

  it("records connected and error states", () => {
    const store = new SessionStateStore();

    store.startPreparing(123);
    expect(store.setConnected(1000)).toMatchObject({
      status: "connected",
      startedAtMs: 1000
    });
    expect(store.setError("WEBRTC_FAILED", "failed")).toMatchObject({
      status: "error",
      errorCode: "WEBRTC_FAILED",
      errorMessage: "failed"
    });
  });

  it("persists active state to trusted session storage", async () => {
    const storage = createMemoryStorage();
    const store = new SessionStateStore(storage);

    store.startPreparing(123);
    store.setStatus("capturing", {
      activeTabId: 123
    });
    await Promise.resolve();

    const restored = new SessionStateStore(storage);
    await restored.hydrate();

    expect(restored.getSnapshot()).toMatchObject({
      status: "capturing",
      activeTabId: 123
    });
  });

  it("clears persisted active state when reset", async () => {
    const storage = createMemoryStorage();
    const store = new SessionStateStore(storage);

    store.startPreparing(123);
    store.reset("stopped");
    await Promise.resolve();

    const restored = new SessionStateStore(storage);
    await restored.hydrate();

    expect(restored.getSnapshot()).toEqual({
      status: "idle"
    });
  });
});

function createMemoryStorage(): TrustedStorageArea {
  const values = new Map<string, unknown>();

  return {
    get: (key: string) => ({
      [key]: values.get(key)
    }),
    set: (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        values.set(key, value);
      }
    },
    remove: (key: string | string[]) => {
      for (const item of Array.isArray(key) ? key : [key]) {
        values.delete(item);
      }
    }
  };
}

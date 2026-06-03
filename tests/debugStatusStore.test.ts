import { describe, expect, it } from "vitest";
import {
  DebugStatusStore,
  LAST_ERROR_STATUS_STORAGE_KEY,
  LAST_STATUS_STORAGE_KEY
} from "../src/background/debugStatusStore";
import { FakeStorageArea } from "./fakeStorageArea";

describe("DebugStatusStore", () => {
  it("stores the last session status without adding transcript or key material", async () => {
    const storage = new FakeStorageArea();
    const store = new DebugStatusStore(storage);

    await store.save({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "WEBRTC_FAILED",
      errorMessage: "OpenAI returned 401: bad ek_REDACTED"
    });

    await expect(store.getLastStatus()).resolves.toEqual({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "WEBRTC_FAILED",
      errorMessage: "OpenAI returned 401: bad ek_REDACTED"
    });
    expect(JSON.stringify(storage.values.get(LAST_STATUS_STORAGE_KEY))).not.toContain("clientSecret");
    expect(JSON.stringify(storage.values.get(LAST_STATUS_STORAGE_KEY))).not.toContain("transcript");
  });

  it("keeps the last error separately when cleanup later publishes stopped", async () => {
    const storage = new FakeStorageArea();
    const store = new DebugStatusStore(storage);

    await store.save({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "WEBRTC_FAILED",
      errorMessage: "OpenAI returned 402"
    });
    await store.save({
      type: "SESSION_STATUS",
      status: "stopped"
    });

    await expect(store.getLastStatus()).resolves.toEqual({
      type: "SESSION_STATUS",
      status: "stopped",
      errorCode: undefined,
      errorMessage: undefined
    });
    await expect(store.getLastErrorStatus()).resolves.toEqual({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "WEBRTC_FAILED",
      errorMessage: "OpenAI returned 402"
    });
    expect(storage.values.has(LAST_ERROR_STATUS_STORAGE_KEY)).toBe(true);
  });

  it("clears stale error diagnostics when a new session starts", async () => {
    const storage = new FakeStorageArea();
    const store = new DebugStatusStore(storage);

    await store.save({
      type: "SESSION_STATUS",
      status: "error",
      errorCode: "WEBRTC_FAILED"
    });
    await store.save({
      type: "SESSION_STATUS",
      status: "preparing"
    });

    await expect(store.getLastErrorStatus()).resolves.toBeUndefined();
  });
});

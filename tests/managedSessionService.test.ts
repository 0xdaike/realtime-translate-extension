import { describe, expect, it, vi } from "vitest";
import {
  ManagedSessionService,
  extractManagedRealtimeSession
} from "../src/background/managedSessionService";

describe("ManagedSessionService", () => {
  it("requests a managed realtime session with cookies and no user API key", async () => {
    let requestInit: RequestInit | undefined;
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          session_url: "wss://managed.example.test/realtime",
          session_token: "managed-session-token-123456789",
          expires_at: expiresAt
        }),
        text: async () => ""
      };
    });
    const service = new ManagedSessionService(
      "https://managed.example.test/v1/realtime/session",
      fetchFn
    );

    await expect(
      service.createSession({
        provider: "openai",
        targetLanguage: "ja"
      })
    ).resolves.toEqual({
      sessionUrl: "wss://managed.example.test/realtime",
      sessionToken: "managed-session-token-123456789",
      expiresAt,
      realtimeOrigin: "wss://managed.example.test"
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://managed.example.test/v1/realtime/session",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    expect(requestInit?.body).toBe(JSON.stringify({
      provider: "openai",
      target_language: "ja"
    }));
    expect(JSON.stringify(requestInit)).not.toContain("sk-");
  });

  it("requires explicit managed service URL configuration", async () => {
    const service = new ManagedSessionService("", vi.fn());

    await expect(
      service.createSession({
        provider: "openai",
        targetLanguage: "ja"
      })
    ).rejects.toMatchObject({
      code: "CLIENT_SECRET_FAILED",
      message: "Managed service URL is not configured."
    });
  });

  it("requires the managed service URL to use https before sending cookies", async () => {
    const fetchFn = vi.fn();
    const service = new ManagedSessionService(
      "http://managed.example.test/v1/realtime/session",
      fetchFn
    );

    await expect(
      service.createSession({
        provider: "openai",
        targetLanguage: "ja"
      })
    ).rejects.toMatchObject({
      code: "CLIENT_SECRET_FAILED",
      message: "Managed service URL must use https."
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("redacts managed service error bodies", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'bad session_token: "managed-session-token-123456789"'
    }));
    const service = new ManagedSessionService(
      "https://managed.example.test/v1/realtime/session",
      fetchFn
    );

    await expect(
      service.createSession({
        provider: "openai",
        targetLanguage: "ja"
      })
    ).rejects.toMatchObject({
      message: 'Managed service returned 401: bad session_token: "REDACTED"'
    });
  });
});

describe("extractManagedRealtimeSession", () => {
  it("extracts managed realtime session payloads", () => {
    const nowMs = Date.parse("2026-05-18T00:00:00.000Z");
    const expiresAt = "2026-05-18T00:01:00.000Z";

    expect(
      extractManagedRealtimeSession({
        session_url: "wss://managed.example.test/realtime",
        session_token: "managed-session-token-123456789",
        expires_at: expiresAt
      }, {
        allowedRealtimeOrigin: "wss://managed.example.test",
        nowMs
      })
    ).toEqual({
      sessionUrl: "wss://managed.example.test/realtime",
      sessionToken: "managed-session-token-123456789",
      expiresAt,
      realtimeOrigin: "wss://managed.example.test"
    });
  });

  it("rejects managed session payloads without an expiry", () => {
    expect(() =>
      extractManagedRealtimeSession({
        session_url: "wss://managed.example.test/realtime",
        session_token: "managed-session-token-123456789"
      })
    ).toThrow("Managed service response did not include an expiry.");
  });

  it("rejects expired managed session payloads", () => {
    expect(() =>
      extractManagedRealtimeSession({
        session_url: "wss://managed.example.test/realtime",
        session_token: "managed-session-token-123456789",
        expires_at: "2026-05-17T23:59:59.000Z"
      }, {
        nowMs: Date.parse("2026-05-18T00:00:00.000Z")
      })
    ).toThrow("Managed service response expiry was already elapsed.");
  });

  it("rejects managed realtime URLs outside the allowed origin", () => {
    expect(() =>
      extractManagedRealtimeSession({
        session_url: "wss://evil.example.test/realtime",
        session_token: "managed-session-token-123456789",
        expires_at: "2026-05-18T00:01:00.000Z"
      }, {
        allowedRealtimeOrigin: "wss://managed.example.test",
        nowMs: Date.parse("2026-05-18T00:00:00.000Z")
      })
    ).toThrow("Managed session URL origin is not allowed.");
  });
});

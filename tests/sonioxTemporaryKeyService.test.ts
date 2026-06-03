import { describe, expect, it, vi } from "vitest";
import {
  SONIOX_MAX_SESSION_DURATION_SECONDS,
  SONIOX_TEMPORARY_KEY_TTL_SECONDS,
  SONIOX_TEMPORARY_KEY_USAGE_TYPE,
  SonioxTemporaryKeyService,
  extractSonioxTemporaryApiKey
} from "../src/background/sonioxTemporaryKeyService";
import { SONIOX_TEMPORARY_API_KEY_URL } from "../src/lib/constants/endpoints";

describe("SonioxTemporaryKeyService", () => {
  it("creates a single-use transcription temporary key with the standard key only in Authorization", async () => {
    const apiKey = ["soniox", "standard-key-123456789"].join("-");
    let requestInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;

      return {
        ok: true,
        status: 201,
        json: async () => ({
          api_key: "temp:temporary-key-123456789",
          expires_at: "2026-05-18T00:01:00.000Z"
        }),
        text: async () => ""
      };
    });
    const service = new SonioxTemporaryKeyService(
      {
        getApiKeyForTrustedContext: async () => apiKey
      },
      fetchFn
    );

    await expect(service.createTemporaryKey()).resolves.toEqual({
      value: "temp:temporary-key-123456789",
      expiresAt: "2026-05-18T00:01:00.000Z"
    });

    expect(fetchFn).toHaveBeenCalledWith(
      SONIOX_TEMPORARY_API_KEY_URL,
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      })
    );

    const requestBody = JSON.parse(requestInit?.body as string);
    expect(requestBody).toEqual({
      usage_type: SONIOX_TEMPORARY_KEY_USAGE_TYPE,
      expires_in_seconds: SONIOX_TEMPORARY_KEY_TTL_SECONDS,
      single_use: true,
      max_session_duration_seconds: SONIOX_MAX_SESSION_DURATION_SECONDS
    });
    expect(JSON.stringify(requestBody)).not.toContain(apiKey);
  });

  it("redacts Soniox keys from error bodies", async () => {
    const apiKey = ["soniox", "standard-key-123456789"].join("-");
    const service = new SonioxTemporaryKeyService(
      {
        getApiKeyForTrustedContext: async () => apiKey
      },
      async () => ({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => `invalid api_key: "temp:temporary-key-123456789" ${apiKey}`
      })
    );

    await expect(service.createTemporaryKey()).rejects.toMatchObject({
      code: "CLIENT_SECRET_FAILED",
      message: 'Soniox returned 401: invalid api_key: "REDACTED" REDACTED'
    });
  });

  it("classifies fetch failures as temporary key failures without leaking the standard key", async () => {
    const apiKey = ["soniox", "standard-key-123456789"].join("-");
    const service = new SonioxTemporaryKeyService(
      {
        getApiKeyForTrustedContext: async () => apiKey
      },
      async () => {
        throw new Error(`network failed ${apiKey}`);
      }
    );

    await expect(service.createTemporaryKey()).rejects.toMatchObject({
      code: "CLIENT_SECRET_FAILED",
      message: "network failed REDACTED"
    });
  });

  it("classifies invalid JSON responses as temporary key failures", async () => {
    const service = new SonioxTemporaryKeyService(
      {
        getApiKeyForTrustedContext: async () => ["soniox", "standard-key-123456789"].join("-")
      },
      async () => ({
        ok: true,
        status: 201,
        json: async () => {
          throw new SyntaxError("bad json");
        },
        text: async () => ""
      })
    );

    await expect(service.createTemporaryKey()).rejects.toMatchObject({
      code: "CLIENT_SECRET_FAILED",
      message: "Soniox response was not valid JSON."
    });
  });
});

describe("extractSonioxTemporaryApiKey", () => {
  it("accepts Soniox temporary key response shape", () => {
    expect(
      extractSonioxTemporaryApiKey({
        api_key: "temp:temporary-key-123456789",
        expires_at: "2026-05-18T00:01:00.000Z"
      })
    ).toEqual({
      value: "temp:temporary-key-123456789",
      expiresAt: "2026-05-18T00:01:00.000Z"
    });
  });

  it("rejects responses without a usable temporary key", () => {
    expect(() => extractSonioxTemporaryApiKey({})).toThrow(
      "Soniox response did not include a temporary API key."
    );
  });
});

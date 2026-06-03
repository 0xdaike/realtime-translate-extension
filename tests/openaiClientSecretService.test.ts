import { describe, expect, it, vi } from "vitest";
import {
  OPENAI_REALTIME_TRANSLATION_MODEL,
  OpenAiClientSecretService,
  extractClientSecret
} from "../src/background/openaiClientSecretService";
import { OPENAI_TRANSLATION_CLIENT_SECRET_URL } from "../src/lib/constants/endpoints";

describe("OpenAiClientSecretService", () => {
  it("creates a translation client secret with the standard key only in Authorization", async () => {
    const apiKey = ["sk", "standard-key-123456789"].join("-");
    let requestInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;

      return {
      ok: true,
      status: 200,
      json: async () => ({
        value: "ek_test_client_secret",
        expires_at: 123
      }),
      text: async () => ""
      };
    });
    const service = new OpenAiClientSecretService(
      {
        getApiKeyForTrustedContext: async () => apiKey
      },
      fetchFn
    );

    await expect(service.createClientSecret("ja")).resolves.toEqual({
      value: "ek_test_client_secret",
      expiresAt: 123
    });

    expect(fetchFn).toHaveBeenCalledWith(
      OPENAI_TRANSLATION_CLIENT_SECRET_URL,
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
      session: {
        model: OPENAI_REALTIME_TRANSLATION_MODEL,
        audio: {
          output: {
            language: "ja"
          }
        }
      }
    });
    expect(JSON.stringify(requestBody)).not.toContain(apiKey);
  });

  it("redacts API keys from OpenAI error bodies", async () => {
    const apiKey = ["sk", "standard-key-123456789"].join("-");
    const leakedKey = ["sk", "leaked-error-123456789"].join("-");
    const service = new OpenAiClientSecretService(
      {
        getApiKeyForTrustedContext: async () => apiKey
      },
      async () => ({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => `invalid ${leakedKey}`
      })
    );

    await expect(service.createClientSecret("ja")).rejects.toMatchObject({
      code: "CLIENT_SECRET_FAILED",
      message: "OpenAI returned 401: invalid sk-REDACTED"
    });
  });

  it("classifies fetch failures as client secret failures", async () => {
    const leakedKey = ["sk", "network-error-123456789"].join("-");
    const service = new OpenAiClientSecretService(
      {
        getApiKeyForTrustedContext: async () => ["sk", "standard-key-123456789"].join("-")
      },
      async () => {
        throw new Error(`network failed ${leakedKey}`);
      }
    );

    await expect(service.createClientSecret("ja")).rejects.toMatchObject({
      code: "CLIENT_SECRET_FAILED",
      message: "network failed sk-REDACTED"
    });
  });

  it("classifies invalid JSON responses as client secret failures", async () => {
    const service = new OpenAiClientSecretService(
      {
        getApiKeyForTrustedContext: async () => ["sk", "standard-key-123456789"].join("-")
      },
      async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("bad json");
        },
        text: async () => ""
      })
    );

    await expect(service.createClientSecret("ja")).rejects.toMatchObject({
      code: "CLIENT_SECRET_FAILED",
      message: "OpenAI response was not valid JSON."
    });
  });
});

describe("extractClientSecret", () => {
  it("accepts top-level client secret response shape", () => {
    expect(extractClientSecret({ value: "secret", expires_at: 1 })).toEqual({
      value: "secret",
      expiresAt: 1
    });
  });

  it("accepts nested client secret response shape", () => {
    expect(
      extractClientSecret({
        session: {
          client_secret: {
            value: "secret",
            expires_at: 2
          }
        }
      })
    ).toEqual({
      value: "secret",
      expiresAt: 2
    });
  });

  it("rejects responses without a usable secret", () => {
    expect(() => extractClientSecret({})).toThrow("OpenAI response did not include a client secret.");
  });
});

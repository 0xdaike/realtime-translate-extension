import { SONIOX_TEMPORARY_API_KEY_URL } from "../lib/constants/endpoints";
import { ExtensionError } from "../lib/errors/errors";
import { ChromeKeyVault, type KeyVault } from "../security/keyVault";
import { redactError, redactSecret } from "../security/redaction";

export const SONIOX_TEMPORARY_KEY_TTL_SECONDS = 300;
export const SONIOX_MAX_SESSION_DURATION_SECONDS = 7200;
export const SONIOX_TEMPORARY_KEY_USAGE_TYPE = "transcribe_websocket";

export type SonioxTemporaryApiKey = {
  value: string;
  expiresAt?: string;
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>;

export class SonioxTemporaryKeyService {
  constructor(
    private readonly keyVault: Pick<KeyVault, "getApiKeyForTrustedContext"> = new ChromeKeyVault(
      chrome.storage.local,
      chrome.storage.session,
      "soniox"
    ),
    private readonly fetchFn: FetchLike = fetchWithGlobalThis
  ) {}

  async createTemporaryKey(): Promise<SonioxTemporaryApiKey> {
    const apiKey = await this.keyVault.getApiKeyForTrustedContext();
    let response: Awaited<ReturnType<FetchLike>>;

    try {
      response = await this.fetchFn(SONIOX_TEMPORARY_API_KEY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usage_type: SONIOX_TEMPORARY_KEY_USAGE_TYPE,
          expires_in_seconds: SONIOX_TEMPORARY_KEY_TTL_SECONDS,
          single_use: true,
          max_session_duration_seconds: SONIOX_MAX_SESSION_DURATION_SECONDS
        })
      });
    } catch (error) {
      throw new ExtensionError(
        "CLIENT_SECRET_FAILED",
        redactSonioxSecrets(redactError(error), apiKey)
      );
    }

    if (!response.ok) {
      throw new ExtensionError(
        "CLIENT_SECRET_FAILED",
        redactSonioxSecrets(`Soniox returned ${response.status}: ${await response.text()}`, apiKey)
      );
    }

    try {
      return extractSonioxTemporaryApiKey(await response.json());
    } catch (error) {
      if (error instanceof ExtensionError) {
        throw error;
      }

      throw new ExtensionError("CLIENT_SECRET_FAILED", "Soniox response was not valid JSON.");
    }
  }
}

export function extractSonioxTemporaryApiKey(value: unknown): SonioxTemporaryApiKey {
  if (!isRecord(value) || typeof value.api_key !== "string" || value.api_key === "") {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Soniox response did not include a temporary API key.");
  }

  return {
    value: value.api_key,
    expiresAt: typeof value.expires_at === "string" ? value.expires_at : undefined
  };
}

function redactSonioxSecrets(input: string, knownApiKey?: string): string {
  let redacted = redactSecret(input);

  if (knownApiKey !== undefined && knownApiKey !== "") {
    redacted = redacted.split(knownApiKey).join("REDACTED");
  }

  return redacted
    .replace(/\btemp:[A-Za-z0-9._:-]{8,}\b/g, "temp:REDACTED")
    .replace(
      /(["']?(?:api_key|apiKey)["']?\s*[:=]\s*["']?)([A-Za-z0-9._:-]{8,})(["']?)/gi,
      "$1REDACTED$3"
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fetchWithGlobalThis(input: RequestInfo | URL, init?: RequestInit): ReturnType<FetchLike> {
  return globalThis.fetch(input, init);
}

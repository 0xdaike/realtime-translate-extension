import {
  OPENAI_TRANSLATION_CLIENT_SECRET_URL
} from "../lib/constants/endpoints";
import { isTargetLanguage, type TargetLanguage } from "../lib/constants/languages";
import { ExtensionError } from "../lib/errors/errors";
import { ChromeKeyVault, type KeyVault } from "../security/keyVault";
import { redactError, redactSecret } from "../security/redaction";

export const OPENAI_REALTIME_TRANSLATION_MODEL = "gpt-realtime-translate";

export type RealtimeTranslationClientSecret = {
  value: string;
  expiresAt?: number;
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>;

export class OpenAiClientSecretService {
  constructor(
    private readonly keyVault: Pick<KeyVault, "getApiKeyForTrustedContext"> = new ChromeKeyVault(),
    private readonly fetchFn: FetchLike = fetchWithGlobalThis
  ) {}

  async createClientSecret(
    targetLanguage: TargetLanguage
  ): Promise<RealtimeTranslationClientSecret> {
    if (!isTargetLanguage(targetLanguage)) {
      throw new ExtensionError("CLIENT_SECRET_FAILED", "Unsupported target language.");
    }

    const apiKey = await this.keyVault.getApiKeyForTrustedContext();
    let response: Awaited<ReturnType<FetchLike>>;

    try {
      response = await this.fetchFn(OPENAI_TRANSLATION_CLIENT_SECRET_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session: {
            model: OPENAI_REALTIME_TRANSLATION_MODEL,
            audio: {
              output: {
                language: targetLanguage
              }
            }
          }
        })
      });
    } catch (error) {
      throw new ExtensionError("CLIENT_SECRET_FAILED", redactError(error));
    }

    if (!response.ok) {
      throw new ExtensionError(
        "CLIENT_SECRET_FAILED",
        redactSecret(`OpenAI returned ${response.status}: ${await response.text()}`)
      );
    }

    try {
      return extractClientSecret(await response.json());
    } catch (error) {
      if (error instanceof ExtensionError) {
        throw error;
      }

      throw new ExtensionError("CLIENT_SECRET_FAILED", "OpenAI response was not valid JSON.");
    }
  }
}

export function extractClientSecret(value: unknown): RealtimeTranslationClientSecret {
  const candidates = [
    value,
    isRecord(value) ? value.client_secret : undefined,
    isRecord(value) && isRecord(value.session) ? value.session.client_secret : undefined
  ];

  for (const candidate of candidates) {
    if (!isRecord(candidate) || typeof candidate.value !== "string" || candidate.value === "") {
      continue;
    }

    return {
      value: candidate.value,
      expiresAt:
        typeof candidate.expires_at === "number" && Number.isFinite(candidate.expires_at)
          ? candidate.expires_at
          : undefined
    };
  }

  throw new ExtensionError("CLIENT_SECRET_FAILED", "OpenAI response did not include a client secret.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fetchWithGlobalThis(input: RequestInfo | URL, init?: RequestInit): ReturnType<FetchLike> {
  return globalThis.fetch(input, init);
}

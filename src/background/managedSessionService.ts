import {
  getAllowedManagedRealtimeOrigin,
  MANAGED_SESSION_URL,
  parseManagedHttpsEndpoint
} from "../lib/constants/managedService";
import type { TargetLanguage } from "../lib/constants/languages";
import type { TranslationProvider } from "../lib/constants/providers";
import { ExtensionError } from "../lib/errors/errors";
import { redactError, redactSecret } from "../security/redaction";

export type ManagedRealtimeSession = {
  sessionUrl: string;
  sessionToken: string;
  expiresAt: string;
  realtimeOrigin: string;
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>;

const MAX_MANAGED_SESSION_TTL_MS = 15 * 60 * 1000;

export class ManagedSessionService {
  constructor(
    private readonly sessionUrl: string = MANAGED_SESSION_URL,
    private readonly fetchFn: FetchLike = fetchWithGlobalThis
  ) {}

  async createSession(options: {
    provider: TranslationProvider;
    targetLanguage: TargetLanguage;
  }): Promise<ManagedRealtimeSession> {
    if (this.sessionUrl === "") {
      throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service URL is not configured.");
    }

    const sessionEndpoint = parseManagedHttpsEndpoint(this.sessionUrl);
    const allowedRealtimeOrigin = getAllowedManagedRealtimeOrigin(this.sessionUrl);

    if (sessionEndpoint === undefined) {
      throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service URL must use https.");
    }

    if (allowedRealtimeOrigin === undefined) {
      throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed realtime origin is not configured.");
    }

    let response: Awaited<ReturnType<FetchLike>>;

    try {
      response = await this.fetchFn(sessionEndpoint.toString(), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider: options.provider,
          target_language: options.targetLanguage
        })
      });
    } catch (error) {
      throw new ExtensionError("CLIENT_SECRET_FAILED", redactError(error));
    }

    if (!response.ok) {
      throw new ExtensionError(
        "CLIENT_SECRET_FAILED",
        redactSecret(`Managed service returned ${response.status}: ${await response.text()}`)
      );
    }

    try {
      return extractManagedRealtimeSession(await response.json(), {
        allowedRealtimeOrigin,
        nowMs: Date.now()
      });
    } catch (error) {
      if (error instanceof ExtensionError) {
        throw error;
      }

      throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service response was not valid JSON.");
    }
  }
}

export function extractManagedRealtimeSession(
  value: unknown,
  options: {
    allowedRealtimeOrigin?: string;
    nowMs?: number;
  } = {}
): ManagedRealtimeSession {
  if (!isRecord(value)) {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service response was not an object.");
  }

  const sessionUrl = value.session_url;
  const sessionToken = value.session_token;
  const expiresAt = value.expires_at;

  if (typeof sessionUrl !== "string" || sessionUrl === "") {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service response did not include a session URL.");
  }

  if (typeof sessionToken !== "string" || sessionToken === "") {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service response did not include a session token.");
  }

  if (typeof expiresAt !== "string" || expiresAt === "") {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service response did not include an expiry.");
  }

  const realtimeUrl = parseManagedRealtimeSessionUrl(sessionUrl, options.allowedRealtimeOrigin);
  const expiresAtMs = Date.parse(expiresAt);
  const nowMs = options.nowMs ?? Date.now();

  if (!Number.isFinite(expiresAtMs)) {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service response expiry was invalid.");
  }

  if (expiresAtMs <= nowMs) {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service response expiry was already elapsed.");
  }

  if (expiresAtMs - nowMs > MAX_MANAGED_SESSION_TTL_MS) {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service response expiry was too far in the future.");
  }

  return {
    sessionUrl: realtimeUrl.toString(),
    sessionToken,
    expiresAt,
    realtimeOrigin: realtimeUrl.origin
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseManagedRealtimeSessionUrl(sessionUrl: string, allowedOrigin?: string): URL {
  let url: URL;

  try {
    url = new URL(sessionUrl);
  } catch {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service returned an invalid session URL.");
  }

  if (url.protocol !== "wss:") {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed session URL must use wss.");
  }

  if (url.search !== "" || url.hash !== "") {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed session URL must not include query or fragment data.");
  }

  if (allowedOrigin !== undefined && url.origin !== allowedOrigin) {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed session URL origin is not allowed.");
  }

  return url;
}

function fetchWithGlobalThis(input: RequestInfo | URL, init?: RequestInit): ReturnType<FetchLike> {
  return globalThis.fetch(input, init);
}

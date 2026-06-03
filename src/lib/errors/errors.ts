export const ERROR_CODES = [
  "API_KEY_MISSING",
  "API_KEY_LOCKED",
  "API_KEY_DECRYPT_FAILED",
  "CLIENT_SECRET_FAILED",
  "TAB_CAPTURE_FAILED",
  "NO_AUDIO_TRACK",
  "OFFSCREEN_CREATE_FAILED",
  "WEBRTC_FAILED",
  "SDP_OFFER_FAILED",
  "REMOTE_AUDIO_FAILED",
  "DATA_CHANNEL_FAILED",
  "CONTENT_SCRIPT_FAILED",
  "AUTOPLAY_BLOCKED",
  "PERMISSION_FAILED",
  "UNSUPPORTED_BROWSER",
  "SESSION_ALREADY_RUNNING",
  "UNKNOWN_ERROR"
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const ERROR_CODE_SET = new Set<string>(ERROR_CODES);

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && ERROR_CODE_SET.has(value);
}

export class ExtensionError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ExtensionError";
    this.code = code;
  }
}

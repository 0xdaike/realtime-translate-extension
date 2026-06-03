const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_+/=-]{8,}\b/g, "sk-REDACTED"],
  [/\bek_[A-Za-z0-9_+/=-]{8,}\b/g, "ek_REDACTED"],
  [/\btemp:[A-Za-z0-9._:+/=-]{8,}\b/g, "temp:REDACTED"],
  [
    /\beyJ[A-Za-z0-9_+/=-]{8,}\.[A-Za-z0-9_+/=-]{8,}\.[A-Za-z0-9_+/=-]{8,}\b/g,
    "JWT_REDACTED"
  ],
  [/\bBearer\s+[A-Za-z0-9._:+/=-]+/gi, "Bearer REDACTED"],
  [
    /(["']?(?:client_secret|clientSecret|ephemeral_key|ephemeralKey|api_key|apiKey|temporaryApiKey|access_token|accessToken|refresh_token|refreshToken|id_token|idToken|session_token|sessionToken)["']?\s*[:=]\s*["']?)([A-Za-z0-9._:+/=-]{8,})(["']?)/gi,
    "$1REDACTED$3"
  ]
];

export function redactSecret(input: string): string {
  return REDACTION_PATTERNS.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    input
  );
}

export function redactError(error: unknown): string {
  if (error instanceof Error) {
    return redactSecret(error.message);
  }

  return redactSecret(String(error));
}

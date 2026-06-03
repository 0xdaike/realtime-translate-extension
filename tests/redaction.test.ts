import { describe, expect, it } from "vitest";
import { redactError, redactSecret } from "../src/security/redaction";

describe("redactSecret", () => {
  it("redacts OpenAI API keys", () => {
    const fakeApiKey = ["sk", "proj-abc123456789_secret"].join("-");
    const input = `failed with ${fakeApiKey}`;

    expect(redactSecret(input)).toBe("failed with sk-REDACTED");
  });

  it("redacts ephemeral tokens", () => {
    const input = "received ek_abc123456789_secret";

    expect(redactSecret(input)).toBe("received ek_REDACTED");
  });

  it("redacts bearer tokens", () => {
    const token = "abc.def-ghi_123";
    const input = `Authorization: Bearer ${token}`;

    expect(redactSecret(input)).toBe("Authorization: Bearer REDACTED");
  });

  it("redacts named client secret fields", () => {
    const fieldName = ["client", "secret"].join("_");
    const input = `${fieldName}: "secret_123456789"`;

    expect(redactSecret(input)).toBe('client_secret: "REDACTED"');
  });

  it("redacts Soniox temporary keys and named API key fields", () => {
    expect(redactSecret("bad temp:soniox.key-123456789:abc")).toBe("bad temp:REDACTED");
    expect(redactSecret('temporaryApiKey: "temp:soniox.key-123456789:abc"')).toBe(
      'temporaryApiKey: "REDACTED"'
    );
    expect(redactSecret('api_key: "soniox.standard-key-123456789"')).toBe(
      'api_key: "REDACTED"'
    );
  });

  it("redacts managed service tokens", () => {
    expect(redactSecret('access_token: "managed-access-token-123456789"')).toBe(
      'access_token: "REDACTED"'
    );
    expect(redactSecret('access_token: "abc+/def==123456789"')).toBe(
      'access_token: "REDACTED"'
    );
    expect(redactSecret('sessionToken: "managed-session-token-123456789"')).toBe(
      'sessionToken: "REDACTED"'
    );
    expect(redactSecret("bad eyJheader123456.payload123456.signature123456")).toBe(
      "bad JWT_REDACTED"
    );
  });

  it("does not redact normal text", () => {
    const input = "status connected, language ja";

    expect(redactSecret(input)).toBe(input);
  });
});

describe("redactError", () => {
  it("redacts error messages", () => {
    const fakeApiKey = ["sk", "proj-abc123456789"].join("-");
    const error = new Error(`bad key ${fakeApiKey}`);

    expect(redactError(error)).toBe("bad key sk-REDACTED");
  });
});

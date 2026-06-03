import { describe, expect, it } from "vitest";
import { ExtensionError } from "../src/lib/errors/errors";
import {
  decryptApiKey,
  encryptApiKey
} from "../src/security/passphraseCrypto";

const TEST_ITERATIONS = 1_000;

describe("passphrase crypto", () => {
  it("decrypts an encrypted API key with the correct passphrase", async () => {
    const apiKey = ["sk", "test-roundtrip-123456789"].join("-");
    const payload = await encryptApiKey(apiKey, "correct horse battery staple", {
      iterations: TEST_ITERATIONS
    });

    await expect(decryptApiKey(payload, "correct horse battery staple")).resolves.toBe(apiKey);
  });

  it("rejects a wrong passphrase", async () => {
    const apiKey = ["sk", "test-wrong-passphrase-123456789"].join("-");
    const payload = await encryptApiKey(apiKey, "right passphrase", {
      iterations: TEST_ITERATIONS
    });

    await expect(decryptApiKey(payload, "wrong passphrase")).rejects.toMatchObject({
      code: "API_KEY_DECRYPT_FAILED"
    } satisfies Partial<ExtensionError>);
  });

  it("uses a fresh salt and IV for each encryption", async () => {
    const apiKey = ["sk", "test-randomness-123456789"].join("-");
    const firstPayload = await encryptApiKey(apiKey, "same passphrase", {
      iterations: TEST_ITERATIONS
    });
    const secondPayload = await encryptApiKey(apiKey, "same passphrase", {
      iterations: TEST_ITERATIONS
    });

    expect(secondPayload.saltBase64).not.toBe(firstPayload.saltBase64);
    expect(secondPayload.ivBase64).not.toBe(firstPayload.ivBase64);
    expect(secondPayload.ciphertextBase64).not.toBe(firstPayload.ciphertextBase64);
  });
});

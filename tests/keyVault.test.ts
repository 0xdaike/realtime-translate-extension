import { describe, expect, it } from "vitest";
import { ExtensionError } from "../src/lib/errors/errors";
import {
  ENCRYPTED_API_KEY_STORAGE_KEY,
  type EncryptedApiKeyRecord
} from "../src/security/encryptedLocalKeyStore";
import { ChromeKeyVault } from "../src/security/keyVault";
import { SESSION_API_KEY_STORAGE_KEY } from "../src/security/sessionKeyStore";
import { FakeStorageArea } from "./fakeStorageArea";

describe("ChromeKeyVault", () => {
  it("stores session-only keys only in session storage", async () => {
    const localStorage = new FakeStorageArea();
    const sessionStorage = new FakeStorageArea();
    const vault = new ChromeKeyVault(localStorage, sessionStorage);
    const apiKey = ["sk", "session-only-123456789"].join("-");

    await vault.storeSessionKey(apiKey);

    await expect(vault.getMode()).resolves.toBe("session_only");
    await expect(vault.getKeyAvailability()).resolves.toBe("available");
    await expect(vault.getApiKeyForTrustedContext()).resolves.toBe(apiKey);
    expect(localStorage.values.has(SESSION_API_KEY_STORAGE_KEY)).toBe(false);
    expect(sessionStorage.values.get(SESSION_API_KEY_STORAGE_KEY)).toBe(apiKey);
  });

  it("stores encrypted keys without plaintext in local storage", async () => {
    const localStorage = new FakeStorageArea();
    const sessionStorage = new FakeStorageArea();
    const vault = new ChromeKeyVault(localStorage, sessionStorage);
    const apiKey = ["sk", "encrypted-local-123456789"].join("-");

    await vault.storeEncryptedKey(apiKey, "passphrase");

    const record = localStorage.values.get(
      ENCRYPTED_API_KEY_STORAGE_KEY
    ) as EncryptedApiKeyRecord;

    expect(record.ciphertextBase64).not.toContain(apiKey);
    expect(record.keyHint).toMatch(/^sk-\.\.\./);
    expect(JSON.stringify([...localStorage.values.entries()])).not.toContain(apiKey);
    await expect(vault.getMode()).resolves.toBe("encrypted_local");
    await expect(vault.getKeyAvailability()).resolves.toBe("available");
  });

  it("requires unlock after encrypted local key is locked", async () => {
    const localStorage = new FakeStorageArea();
    const sessionStorage = new FakeStorageArea();
    const vault = new ChromeKeyVault(localStorage, sessionStorage);
    const apiKey = ["sk", "lock-unlock-123456789"].join("-");

    await vault.storeEncryptedKey(apiKey, "passphrase");
    await vault.lock();

    await expect(vault.getKeyAvailability()).resolves.toBe("locked");
    await expect(vault.getApiKeyForTrustedContext()).rejects.toMatchObject({
      code: "API_KEY_LOCKED"
    } satisfies Partial<ExtensionError>);

    await vault.unlock("passphrase");

    await expect(vault.getApiKeyForTrustedContext()).resolves.toBe(apiKey);
  });

  it("deletes encrypted and session key material", async () => {
    const localStorage = new FakeStorageArea();
    const sessionStorage = new FakeStorageArea();
    const vault = new ChromeKeyVault(localStorage, sessionStorage);
    const apiKey = ["sk", "delete-key-123456789"].join("-");

    await vault.storeEncryptedKey(apiKey, "passphrase");
    await vault.deleteKey();

    expect(localStorage.values.has(ENCRYPTED_API_KEY_STORAGE_KEY)).toBe(false);
    expect(sessionStorage.values.has(SESSION_API_KEY_STORAGE_KEY)).toBe(false);
    await expect(vault.getApiKeyForTrustedContext()).rejects.toMatchObject({
      code: "API_KEY_MISSING"
    } satisfies Partial<ExtensionError>);
  });

  it("keeps OpenAI and Soniox keys in separate storage slots", async () => {
    const localStorage = new FakeStorageArea();
    const sessionStorage = new FakeStorageArea();
    const openAiVault = new ChromeKeyVault(localStorage, sessionStorage, "openai");
    const sonioxVault = new ChromeKeyVault(localStorage, sessionStorage, "soniox");

    await openAiVault.storeSessionKey("sk-openai-key-123456789");
    await sonioxVault.storeSessionKey("soniox-key-123456789");

    await expect(openAiVault.getApiKeyForTrustedContext()).resolves.toBe("sk-openai-key-123456789");
    await expect(sonioxVault.getApiKeyForTrustedContext()).resolves.toBe("soniox-key-123456789");
    expect(JSON.stringify([...sessionStorage.values.entries()])).toContain("openaiApiKey");
    expect(JSON.stringify([...sessionStorage.values.entries()])).toContain("sonioxApiKey");
  });
});

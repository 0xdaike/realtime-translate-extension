import { ExtensionError } from "../lib/errors/errors";

export const PASSPHRASE_KDF = "PBKDF2-SHA256";
export const DEFAULT_PASSPHRASE_ITERATIONS = 250_000;
export const AES_GCM_IV_BYTE_LENGTH = 12;
export const PBKDF2_SALT_BYTE_LENGTH = 16;

export type EncryptedApiKeyPayload = {
  version: 1;
  kdf: typeof PASSPHRASE_KDF;
  iterations: number;
  saltBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
};

export type EncryptApiKeyOptions = {
  iterations?: number;
  now?: Date;
};

export async function encryptApiKey(
  apiKey: string,
  passphrase: string,
  options: EncryptApiKeyOptions = {}
): Promise<EncryptedApiKeyPayload> {
  const crypto = getWebCrypto();
  const salt = randomBytes(crypto, PBKDF2_SALT_BYTE_LENGTH);
  const iv = randomBytes(crypto, AES_GCM_IV_BYTE_LENGTH);
  const iterations = options.iterations ?? DEFAULT_PASSPHRASE_ITERATIONS;
  const key = await deriveAesKey(passphrase, salt, iterations);
  const plaintextBytes = new TextEncoder().encode(apiKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintextBytes)
  );

  return {
    version: 1,
    kdf: PASSPHRASE_KDF,
    iterations,
    saltBase64: bytesToBase64(salt),
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptApiKey(
  payload: EncryptedApiKeyPayload,
  passphrase: string
): Promise<string> {
  try {
    validatePayload(payload);

    const crypto = getWebCrypto();
    const salt = base64ToBytes(payload.saltBase64);
    const iv = base64ToBytes(payload.ivBase64);
    const ciphertext = base64ToBytes(payload.ciphertextBase64);
    const key = await deriveAesKey(passphrase, salt, payload.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    throw new ExtensionError("API_KEY_DECRYPT_FAILED");
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  if (passphrase === "" || iterations < 1) {
    throw new ExtensionError("API_KEY_DECRYPT_FAILED");
  }

  const crypto = getWebCrypto();
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey("raw", passphraseBytes, "PBKDF2", false, [
    "deriveKey"
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function randomBytes(crypto: Crypto, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytes;
}

function getWebCrypto(): Crypto {
  if (globalThis.crypto?.subtle === undefined) {
    throw new ExtensionError("UNSUPPORTED_BROWSER", "WebCrypto is not available.");
  }

  return globalThis.crypto;
}

function validatePayload(payload: EncryptedApiKeyPayload): void {
  if (
    payload.version !== 1 ||
    payload.kdf !== PASSPHRASE_KDF ||
    payload.iterations < 1 ||
    payload.saltBase64 === "" ||
    payload.ivBase64 === "" ||
    payload.ciphertextBase64 === ""
  ) {
    throw new ExtensionError("API_KEY_DECRYPT_FAILED");
  }
}

export const KEY_STORAGE_MODES = ["session_only", "encrypted_local", "local_broker"] as const;

export type KeyStorageMode = (typeof KEY_STORAGE_MODES)[number];

const KEY_STORAGE_MODE_SET = new Set<string>(KEY_STORAGE_MODES);

export function isKeyStorageMode(value: unknown): value is KeyStorageMode {
  return typeof value === "string" && KEY_STORAGE_MODE_SET.has(value);
}

import type { TrustedStorageArea } from "../src/security/storageArea";

export class FakeStorageArea implements TrustedStorageArea {
  readonly values = new Map<string, unknown>();

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: this.values.get(key) };
  }

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.values.set(key, value);
    }
  }

  async remove(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];

    for (const storageKey of keys) {
      this.values.delete(storageKey);
    }
  }
}

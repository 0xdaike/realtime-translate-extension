export type TrustedStorageArea = {
  get(key: string): Promise<Record<string, unknown>> | Record<string, unknown>;
  set(items: Record<string, unknown>): Promise<void> | void;
  remove(key: string | string[]): Promise<void> | void;
};

export async function getStorageValue<T>(
  storageArea: TrustedStorageArea,
  key: string
): Promise<T | undefined> {
  const values = (await storageArea.get(key)) as Record<string, T | undefined>;
  return values[key];
}

export async function setStorageValue<T>(
  storageArea: TrustedStorageArea,
  key: string,
  value: T
): Promise<void> {
  await storageArea.set({ [key]: value });
}

export async function removeStorageValue(
  storageArea: TrustedStorageArea,
  key: string
): Promise<void> {
  await storageArea.remove(key);
}

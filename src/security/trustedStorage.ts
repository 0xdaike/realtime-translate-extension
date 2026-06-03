type StorageAreaWithAccessLevel = chrome.storage.StorageArea & {
  setAccessLevel?: (accessOptions: {
    accessLevel: "TRUSTED_CONTEXTS" | "TRUSTED_AND_UNTRUSTED_CONTEXTS";
  }) => Promise<void> | void;
};

export async function initializeTrustedStorageAccess(): Promise<void> {
  await Promise.all([
    setTrustedContextOnly(chrome.storage.local),
    setTrustedContextOnly(chrome.storage.session)
  ]);
}

async function setTrustedContextOnly(area: StorageAreaWithAccessLevel): Promise<void> {
  if (typeof area.setAccessLevel !== "function") {
    return;
  }

  await area.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

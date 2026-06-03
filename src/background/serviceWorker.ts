import { BackgroundSessionController } from "./sessionController";
import { ContentScriptController } from "./contentScriptController";
import { registerMessageRouter } from "./messageRouter";
import { OffscreenController } from "./offscreenController";
import { ManagedSessionService } from "./managedSessionService";
import { OpenAiClientSecretService } from "./openaiClientSecretService";
import { SonioxTemporaryKeyService } from "./sonioxTemporaryKeyService";
import { TabCaptureController } from "./tabCaptureController";
import { UsageController } from "./usageController";
import { DebugStatusStore } from "./debugStatusStore";
import { SessionStateStore } from "../lib/state/sessionState";
import { initializeTrustedStorageAccess } from "../security/trustedStorage";
import type { TrustedStorageArea } from "../security/storageArea";
import type { ExtensionMessage } from "../types/messages";

void initializeTrustedStorageAccess();

const sessionState = new SessionStateStore(chrome.storage.session as TrustedStorageArea);
void sessionState.hydrate().catch(() => undefined);
const tabCaptureController = new TabCaptureController();
const offscreenController = new OffscreenController();
const openAiClientSecretService = new OpenAiClientSecretService();
const sonioxTemporaryKeyService = new SonioxTemporaryKeyService();
const managedSessionService = new ManagedSessionService();
const contentScriptController = new ContentScriptController();
const debugStatusStore = new DebugStatusStore();
const usageController = new UsageController(publishUsage);
const sessionController = new BackgroundSessionController(
  sessionState,
  publishStatus,
  tabCaptureController,
  offscreenController,
  openAiClientSecretService,
  contentScriptController,
  usageController,
  sonioxTemporaryKeyService,
  managedSessionService
);

registerMessageRouter({
  getSessionStatus: async () => sessionController.getCurrentStatus(),
  getLastSessionStatus: async () =>
    (await debugStatusStore.getLastErrorStatus()) ?? debugStatusStore.getLastStatus(),
  startTranslation: (message) => sessionController.startTranslation(message),
  stopTranslation: (message) => sessionController.stopTranslation(message),
  updateVolume: (message) => sessionController.updateVolume(message),
  handleOffscreenStatus: (message) => sessionController.handleOffscreenStatus(message),
  handleTranscriptDelta: (message) => sessionController.forwardTranscriptDelta(message)
});

chrome.runtime.onInstalled.addListener(() => {
  void initializeTrustedStorageAccess();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const snapshot = sessionState.getSnapshot();

  if (snapshot.activeTabId === tabId) {
    void sessionController.stopBecauseTabClosed();
  }
});

async function publishStatus(
  message: Extract<ExtensionMessage, { type: "SESSION_STATUS" }>
): Promise<void> {
  await debugStatusStore.save(message).catch(() => undefined);
  await chrome.runtime.sendMessage(message).catch(() => undefined);
}

async function publishUsage(
  message: Extract<ExtensionMessage, { type: "USAGE_TICK" }>
): Promise<void> {
  await chrome.runtime.sendMessage(message).catch(() => undefined);
}

import { ExtensionError } from "../lib/errors/errors";
import type { ExtensionMessage } from "../types/messages";

type ScriptingApi = {
  executeScript(options: { target: { tabId: number }; files: string[] }): Promise<unknown>;
};

type TabsApi = {
  sendMessage(tabId: number, message: ExtensionMessage): Promise<unknown>;
};

const CONTENT_SCRIPT_FILE = "src/content/overlay.js";

export class ContentScriptController {
  constructor(
    private readonly scriptingApi: ScriptingApi = chrome.scripting as unknown as ScriptingApi,
    private readonly tabsApi: TabsApi = chrome.tabs as unknown as TabsApi
  ) {}

  async injectOverlay(tabId: number): Promise<void> {
    try {
      await this.scriptingApi.executeScript({
        target: { tabId },
        files: [CONTENT_SCRIPT_FILE]
      });
    } catch (error) {
      throw new ExtensionError("CONTENT_SCRIPT_FAILED", "Could not inject subtitle overlay.");
    }
  }

  async initializeOverlay(
    tabId: number,
    message: Extract<ExtensionMessage, { type: "OVERLAY_INIT" }>
  ): Promise<void> {
    await this.sendToTab(tabId, message);
  }

  async removeOverlay(tabId: number): Promise<void> {
    await this.sendToTab(tabId, { type: "OVERLAY_REMOVE" });
  }

  async forwardStatus(
    tabId: number,
    message: Extract<ExtensionMessage, { type: "SESSION_STATUS" }>
  ): Promise<void> {
    await this.sendToTab(tabId, message);
  }

  async forwardTranscriptDelta(
    tabId: number,
    message: Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>
  ): Promise<void> {
    await this.sendToTab(tabId, message);
  }

  private async sendToTab(tabId: number, message: ExtensionMessage): Promise<void> {
    try {
      await this.tabsApi.sendMessage(tabId, message);
    } catch (error) {
      throw new ExtensionError("CONTENT_SCRIPT_FAILED", "Could not send message to subtitle overlay.");
    }
  }
}

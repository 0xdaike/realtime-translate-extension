import { ExtensionError } from "../lib/errors/errors";
import type { ExtensionMessage } from "../types/messages";

type OffscreenApi = {
  hasDocument?: () => Promise<boolean>;
  createDocument(options: {
    url: string;
    reasons: string[];
    justification: string;
  }): Promise<void>;
  closeDocument(): Promise<void>;
};

type RuntimeApi = {
  getURL(path: string): string;
  getContexts?: (filter: {
    contextTypes: string[];
    documentUrls: string[];
  }) => Promise<Array<unknown>>;
  sendMessage(message: ExtensionMessage): Promise<unknown>;
};

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";

export class OffscreenController {
  constructor(
    private readonly offscreenApi: OffscreenApi = chrome.offscreen as unknown as OffscreenApi,
    private readonly runtimeApi: RuntimeApi = chrome.runtime as unknown as RuntimeApi
  ) {}

  async ensureDocument(): Promise<void> {
    try {
      const documentUrl = this.runtimeApi.getURL(OFFSCREEN_DOCUMENT_PATH);

      if (await this.hasExistingDocument(documentUrl)) {
        return;
      }

      await this.offscreenApi.createDocument({
        url: documentUrl,
        reasons: ["USER_MEDIA", "WEB_RTC", "AUDIO_PLAYBACK"],
        justification: "Capture tab audio and run realtime translation media handling."
      });
    } catch (error) {
      throw new ExtensionError("OFFSCREEN_CREATE_FAILED", "Could not create offscreen document.");
    }
  }

  async sendStart(message: Extract<ExtensionMessage, { type: "OFFSCREEN_START" }>): Promise<void> {
    await this.ensureDocument();
    await this.runtimeApi.sendMessage(message);
  }

  async sendStop(reason: Extract<ExtensionMessage, { type: "OFFSCREEN_STOP" }>["reason"]): Promise<void> {
    await this.runtimeApi.sendMessage({
      type: "OFFSCREEN_STOP",
      reason
    });
  }

  async sendVolumeUpdate(message: Extract<ExtensionMessage, { type: "VOLUME_UPDATE" }>): Promise<void> {
    await this.runtimeApi.sendMessage(message);
  }

  async closeDocument(): Promise<void> {
    await this.offscreenApi.closeDocument();
  }

  private async hasExistingDocument(documentUrl: string): Promise<boolean> {
    if (this.runtimeApi.getContexts !== undefined) {
      const contexts = await this.runtimeApi.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [documentUrl]
      });
      return contexts.length > 0;
    }

    return this.offscreenApi.hasDocument !== undefined && (await this.offscreenApi.hasDocument());
  }
}

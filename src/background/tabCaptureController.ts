import { ExtensionError } from "../lib/errors/errors";

export type CapturedTabAudioStream = {
  tabId: number;
  streamId: string;
};

type ActiveTab = {
  id?: number;
};

type TabsApi = {
  query(queryInfo: chrome.tabs.QueryInfo): Promise<ActiveTab[]>;
};

type TabCaptureApi = {
  getMediaStreamId(options: { targetTabId: number }): Promise<string>;
};

export class TabCaptureController {
  constructor(
    private readonly tabsApi: TabsApi = chrome.tabs as unknown as TabsApi,
    private readonly tabCaptureApi: TabCaptureApi = chrome.tabCapture as unknown as TabCaptureApi
  ) {}

  async getActiveTabAudioStream(): Promise<CapturedTabAudioStream> {
    const activeTab = await this.getActiveTab();

    if (activeTab.id === undefined) {
      throw new ExtensionError("TAB_CAPTURE_FAILED", "Active tab has no tab ID.");
    }

    try {
      const streamId = await this.tabCaptureApi.getMediaStreamId({
        targetTabId: activeTab.id
      });

      if (streamId === "") {
        throw new ExtensionError("TAB_CAPTURE_FAILED", "Chrome returned an empty stream ID.");
      }

      return {
        tabId: activeTab.id,
        streamId
      };
    } catch (error) {
      if (error instanceof ExtensionError) {
        throw error;
      }

      throw new ExtensionError("TAB_CAPTURE_FAILED", "Could not capture active tab audio.");
    }
  }

  async getActiveTab(): Promise<ActiveTab> {
    const tabs = await this.tabsApi.query({
      active: true,
      currentWindow: true
    });

    const activeTab = tabs[0];

    if (activeTab === undefined) {
      throw new ExtensionError("TAB_CAPTURE_FAILED", "No active tab found.");
    }

    return activeTab;
  }
}

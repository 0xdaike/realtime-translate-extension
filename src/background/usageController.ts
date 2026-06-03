import {
  loadUserSettings,
  saveUserSettings
} from "../lib/storage/settingsStorage";
import {
  addLocalUsageSeconds,
  getLocalDateKey,
  getLocalMonthKey
} from "../lib/usage/localUsageTimer";
import { estimateRealtimeTranslateCostUsd } from "../lib/usage/costEstimator";
import type { TranslationProvider } from "../lib/constants/providers";
import type { TrustedStorageArea } from "../security/storageArea";
import type { ExtensionMessage } from "../types/messages";

type UsageTickMessage = Extract<ExtensionMessage, { type: "USAGE_TICK" }>;
type UsagePublisher = (message: UsageTickMessage) => Promise<void>;

export class UsageController {
  private intervalId?: ReturnType<typeof setInterval>;
  private elapsedSeconds = 0;
  private activeProvider: TranslationProvider = "openai";
  private sessionGeneration = 0;
  private recordQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly publishUsage: UsagePublisher,
    private readonly storageArea: TrustedStorageArea = chrome.storage.local as TrustedStorageArea
  ) {}

  start(provider: TranslationProvider = "openai"): void {
    if (this.intervalId !== undefined) {
      return;
    }

    this.activeProvider = provider;
    this.elapsedSeconds = 0;
    this.sessionGeneration += 1;
    const generation = this.sessionGeneration;
    this.intervalId = setInterval(() => {
      this.recordQueue = this.recordQueue
        .then(() => this.recordUsageSecond(new Date(), generation))
        .catch(() => undefined);
    }, 1000);
  }

  stop(): void {
    if (this.intervalId === undefined) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = undefined;
    this.elapsedSeconds = 0;
    this.sessionGeneration += 1;
  }

  async recordUsageSecond(now: Date = new Date(), generation = this.sessionGeneration): Promise<void> {
    if (generation !== this.sessionGeneration) {
      return;
    }

    const settings = await loadUserSettings(this.storageArea);
    const nextSettings = addLocalUsageSeconds(settings, 1, now);
    await saveUserSettings(nextSettings, this.storageArea);

    if (generation !== this.sessionGeneration) {
      return;
    }

    this.elapsedSeconds += 1;
    const todaySeconds = nextSettings.localUsage.byDay[getLocalDateKey(now)] ?? 0;
    const monthSeconds = nextSettings.localUsage.byMonth[getLocalMonthKey(now)] ?? 0;

    await this.publishUsage({
      type: "USAGE_TICK",
      elapsedSeconds: this.elapsedSeconds,
      todaySeconds,
      monthSeconds,
      totalSeconds: nextSettings.localUsage.totalSeconds,
      estimatedCostUsd: estimateRealtimeTranslateCostUsd(monthSeconds, this.activeProvider)
    });
  }
}

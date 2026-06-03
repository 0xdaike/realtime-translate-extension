import { getUserFacingErrorMessage } from "../lib/errors/userFacingMessages";
import { ExtensionError, type ErrorCode } from "../lib/errors/errors";
import type { SessionStateStore, SessionSnapshot } from "../lib/state/sessionState";
import type { TranslationProvider } from "../lib/constants/providers";
import { redactError } from "../security/redaction";
import type { ExtensionMessage } from "../types/messages";
import type { ContentScriptController } from "./contentScriptController";
import type { ManagedSessionService } from "./managedSessionService";
import type { OpenAiClientSecretService } from "./openaiClientSecretService";
import type { OffscreenController } from "./offscreenController";
import type { SonioxTemporaryKeyService } from "./sonioxTemporaryKeyService";
import type { TabCaptureController } from "./tabCaptureController";
import type { UsageController } from "./usageController";

type StatusMessage = Extract<ExtensionMessage, { type: "SESSION_STATUS" }>;
type PopupStartMessage = Extract<ExtensionMessage, { type: "POPUP_START_TRANSLATION" }>;
type PopupStopMessage = Extract<ExtensionMessage, { type: "POPUP_STOP_TRANSLATION" }>;
type VolumeUpdateMessage = Extract<ExtensionMessage, { type: "VOLUME_UPDATE" }>;
type TranscriptDeltaMessage = Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>;

type StatusPublisher = (message: StatusMessage) => Promise<void>;

export class BackgroundSessionController {
  private activeProvider: TranslationProvider = "openai";

  constructor(
    private readonly sessionState: SessionStateStore,
    private readonly publishStatus: StatusPublisher,
    private readonly tabCaptureController?: TabCaptureController,
    private readonly offscreenController?: OffscreenController,
    private readonly openAiClientSecretService?: OpenAiClientSecretService,
    private readonly contentScriptController?: ContentScriptController,
    private readonly usageController?: UsageController,
    private readonly sonioxTemporaryKeyService?: SonioxTemporaryKeyService,
    private readonly managedSessionService?: ManagedSessionService
  ) {}

  async startTranslation(message: PopupStartMessage): Promise<void> {
    try {
      this.activeProvider = message.provider;
      await this.publishSnapshot(this.sessionState.startPreparing());

      if (
        this.tabCaptureController === undefined ||
        this.offscreenController === undefined ||
        (message.serviceMode === "managed" && this.managedSessionService === undefined) ||
        (message.serviceMode === "byok" &&
          message.provider === "openai" &&
          this.openAiClientSecretService === undefined) ||
        (message.serviceMode === "byok" &&
          message.provider === "soniox" &&
          this.sonioxTemporaryKeyService === undefined)
      ) {
        throw new ExtensionError("UNKNOWN_ERROR", "Background session dependencies are missing.");
      }

      const tabAudioStream = await this.tabCaptureController.getActiveTabAudioStream();
      await this.publishSnapshot(
        this.sessionState.setStatus("capturing", {
          activeTabId: tabAudioStream.tabId
        })
      );

      if (message.subtitleEnabled) {
        await this.contentScriptController?.injectOverlay(tabAudioStream.tabId);
        await this.contentScriptController?.initializeOverlay(tabAudioStream.tabId, {
          type: "OVERLAY_INIT",
          targetLanguage: message.targetLanguage,
          showSourceTranscript: message.showSourceTranscript
        });
      }

      await this.publishSnapshot(this.sessionState.setStatus("connecting"));

      if (message.serviceMode === "managed") {
        const managedSession = await this.managedSessionService!.createSession({
          provider: message.provider,
          targetLanguage: message.targetLanguage
        });

        await this.offscreenController.sendStart({
          type: "OFFSCREEN_START",
          provider: "managed",
          managedProvider: message.provider,
          tabId: tabAudioStream.tabId,
          streamId: tabAudioStream.streamId,
          sessionUrl: managedSession.sessionUrl,
          sessionToken: managedSession.sessionToken,
          realtimeOrigin: managedSession.realtimeOrigin,
          targetLanguage: message.targetLanguage,
          originalVolume: message.originalVolume,
          translationVolume: message.translationVolume,
          subtitleEnabled: message.provider === "soniox" ? true : message.subtitleEnabled,
          showSourceTranscript: message.showSourceTranscript
        });
        return;
      }

      if (message.provider === "soniox") {
        const temporaryApiKey = await this.sonioxTemporaryKeyService!.createTemporaryKey();

        await this.offscreenController.sendStart({
          type: "OFFSCREEN_START",
          provider: "soniox",
          tabId: tabAudioStream.tabId,
          streamId: tabAudioStream.streamId,
          temporaryApiKey: temporaryApiKey.value,
          targetLanguage: message.targetLanguage,
          originalVolume: message.originalVolume,
          translationVolume: message.translationVolume,
          subtitleEnabled: message.subtitleEnabled,
          showSourceTranscript: message.showSourceTranscript
        });
        return;
      }

      const clientSecret = await this.openAiClientSecretService!.createClientSecret(
        message.targetLanguage
      );

      await this.offscreenController.sendStart({
        type: "OFFSCREEN_START",
        provider: "openai",
        tabId: tabAudioStream.tabId,
        streamId: tabAudioStream.streamId,
        clientSecret: clientSecret.value,
        targetLanguage: message.targetLanguage,
        originalVolume: message.originalVolume,
        translationVolume: message.translationVolume,
        subtitleEnabled: message.subtitleEnabled,
        showSourceTranscript: message.showSourceTranscript
      });
    } catch (error) {
      await this.cleanupActiveSession("error");
      const [errorCode, errorMessage] = normalizeSessionError(error);
      await this.publishSnapshot(this.sessionState.setError(errorCode, errorMessage));
    }
  }

  async stopTranslation(_message: PopupStopMessage): Promise<void> {
    await this.publishSnapshot(this.sessionState.setStatus("stopping"));
    await this.offscreenController?.sendStop("user").catch(() => undefined);
    await this.cleanupActiveSession("user");
    await this.publishSnapshot(this.sessionState.reset("stopped"));
  }

  async stopBecauseTabClosed(): Promise<void> {
    await this.cleanupActiveSession("tab_closed");
    await this.publishSnapshot(this.sessionState.reset("stopped"));
  }

  async updateVolume(message: VolumeUpdateMessage): Promise<void> {
    await this.offscreenController?.sendVolumeUpdate(message).catch(() => undefined);
  }

  async forwardTranscriptDelta(message: TranscriptDeltaMessage): Promise<void> {
    const activeTabId = this.sessionState.getSnapshot().activeTabId;

    if (activeTabId === undefined) {
      return;
    }

    await this.contentScriptController?.forwardTranscriptDelta(activeTabId, message).catch(() => undefined);
  }

  getCurrentStatus(): StatusMessage {
    return this.toStatusMessage(this.sessionState.getSnapshot());
  }

  async handleOffscreenStatus(message: StatusMessage): Promise<void> {
    const currentSnapshot = this.sessionState.getSnapshot();

    if (
      currentSnapshot.status === "error" &&
      (message.status === "stopping" || message.status === "stopped")
    ) {
      return;
    }

    if (message.status === "connected") {
      this.usageController?.start(this.activeProvider);
      await this.publishSnapshot(this.sessionState.setConnected());
      return;
    }

    if (message.status === "error") {
      await this.cleanupActiveSession("error");
      await this.publishSnapshot(
        this.sessionState.setError(message.errorCode ?? "UNKNOWN_ERROR", message.errorMessage)
      );
      return;
    }

    if (message.status === "stopped") {
      if (currentSnapshot.status !== "stopping" && currentSnapshot.status !== "idle" && currentSnapshot.status !== "stopped") {
        await this.cleanupActiveSession("error");
        await this.publishSnapshot(
          this.sessionState.setError(
            "UNKNOWN_ERROR",
            `Offscreen document stopped unexpectedly while session was ${currentSnapshot.status}.`
          )
        );
        return;
      }

      await this.cleanupActiveSession("user");
      await this.publishSnapshot(this.sessionState.reset("stopped"));
      return;
    }

    await this.publishSnapshot(
      this.sessionState.setStatus(message.status, {
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      })
    );
  }

  private async publishSnapshot(snapshot: SessionSnapshot): Promise<void> {
    const message = this.toStatusMessage(snapshot);

    await this.publishStatus(message);

    if (snapshot.activeTabId !== undefined) {
      await this.contentScriptController?.forwardStatus(snapshot.activeTabId, message).catch(() => undefined);
    }
  }

  private toStatusMessage(snapshot: SessionSnapshot): StatusMessage {
    return {
      type: "SESSION_STATUS",
      status: snapshot.status,
      errorCode: snapshot.errorCode,
      errorMessage:
        snapshot.errorCode === undefined
          ? snapshot.errorMessage
          : getUserFacingErrorMessage(snapshot.errorCode, snapshot.errorMessage)
    };
  }

  private async cleanupActiveSession(reason: "user" | "tab_closed" | "error"): Promise<void> {
    const activeTabId = this.sessionState.getSnapshot().activeTabId;

    this.usageController?.stop();

    if (reason !== "user") {
      await this.offscreenController?.sendStop(reason).catch(() => undefined);
    }

    if (activeTabId !== undefined) {
      await this.contentScriptController?.removeOverlay(activeTabId).catch(() => undefined);
    }

    await this.offscreenController?.closeDocument?.().catch(() => undefined);
  }
}

function normalizeSessionError(error: unknown): [ErrorCode, string | undefined] {
  if (error instanceof ExtensionError) {
    return [error.code, redactError(error)];
  }

  if (error instanceof Error) {
    return ["UNKNOWN_ERROR", redactError(error)];
  }

  return ["UNKNOWN_ERROR", undefined];
}

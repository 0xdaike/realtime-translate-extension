import { ExtensionError } from "../lib/errors/errors";
import { isTargetLanguage } from "../lib/constants/languages";
import { redactError } from "../security/redaction";
import type { ExtensionMessage } from "../types/messages";
import { TabAudioGraph } from "./audioGraph";
import { ManagedRealtimeTranslationPeer } from "./managedRealtimeTranslationPeer";
import { RealtimeTranslationPeer } from "./realtimeTranslationPeer";
import { SonioxRealtimeTranslationPeer } from "./sonioxRealtimeTranslationPeer";
import { resolveTabAudioStream, stopMediaStream } from "./tabAudioStream";
import { TranslatedAudioPlayer } from "./translatedAudioPlayer";

type OffscreenStartMessage = Extract<ExtensionMessage, { type: "OFFSCREEN_START" }>;
type OffscreenStopMessage = Extract<ExtensionMessage, { type: "OFFSCREEN_STOP" }>;
type VolumeUpdateMessage = Extract<ExtensionMessage, { type: "VOLUME_UPDATE" }>;
type SessionStatusMessage = Extract<ExtensionMessage, { type: "SESSION_STATUS" }>;

class OffscreenSessionRuntime {
  private tabAudioStream?: MediaStream;
  private audioGraph?: TabAudioGraph;
  private translatedAudioPlayer?: TranslatedAudioPlayer;
  private realtimePeer?: RealtimeTranslationPeer;
  private sonioxPeer?: SonioxRealtimeTranslationPeer;
  private managedPeer?: ManagedRealtimeTranslationPeer;
  private showSourceTranscript = false;
  private subtitleEnabled = false;

  async start(message: OffscreenStartMessage): Promise<void> {
    await this.cleanup();

    try {
      await sendStatus({ status: "capturing" });
      this.showSourceTranscript = message.showSourceTranscript;
      this.subtitleEnabled = message.subtitleEnabled;

      this.tabAudioStream = await resolveTabAudioStream(message.streamId);
      this.audioGraph = new TabAudioGraph(
        this.tabAudioStream,
        message.originalVolume
      );
      await this.audioGraph.resume();

      await sendStatus({ status: "connecting" });

      if (message.provider === "managed") {
        this.translatedAudioPlayer = new TranslatedAudioPlayer();
        this.managedPeer = new ManagedRealtimeTranslationPeer();
        await this.managedPeer.start({
          sourceStream: this.tabAudioStream,
          sessionUrl: message.sessionUrl,
          sessionToken: message.sessionToken,
          realtimeOrigin: message.realtimeOrigin,
          callbacks: {
            onConnected: () => sendStatus({ status: "connected" }),
            onError: (errorMessage) =>
              sendStatus({
                status: "error",
                errorCode: "DATA_CHANNEL_FAILED",
                errorMessage
              }),
            onRemoteAudioStream: (stream) =>
              this.translatedAudioPlayer?.playStream(stream, message.translationVolume),
            onTranscriptDelta: (transcriptMessage) => this.forwardTranscript(transcriptMessage)
          }
        });
        return;
      }

      if (message.provider === "soniox") {
        this.sonioxPeer = new SonioxRealtimeTranslationPeer();
        await this.sonioxPeer.start({
          sourceStream: this.tabAudioStream,
          temporaryApiKey: message.temporaryApiKey,
          targetLanguage: message.targetLanguage,
          callbacks: {
            onConnected: () => sendStatus({ status: "connected" }),
            onError: (errorMessage) =>
              sendStatus({
                status: "error",
                errorCode: "DATA_CHANNEL_FAILED",
                errorMessage
              }),
            onTranscriptDelta: (transcriptMessage) => this.forwardTranscript(transcriptMessage)
          }
        });
        return;
      }

      this.translatedAudioPlayer = new TranslatedAudioPlayer();
      this.realtimePeer = new RealtimeTranslationPeer();

      await this.realtimePeer.start({
        sourceStream: this.tabAudioStream,
        clientSecret: message.clientSecret,
        callbacks: {
          onConnected: () => sendStatus({ status: "connected" }),
          onError: (errorMessage) =>
            sendStatus({
              status: "error",
              errorCode: "DATA_CHANNEL_FAILED",
              errorMessage
            }),
          onRemoteAudioStream: (stream) =>
            this.translatedAudioPlayer?.playStream(stream, message.translationVolume),
          onTranscriptDelta: (transcriptMessage) => this.forwardTranscript(transcriptMessage)
        }
      });
    } catch (error) {
      await sendStatus(toErrorStatus(error));
      await this.cleanup();
    }
  }

  async stop(_message: OffscreenStopMessage): Promise<void> {
    await sendStatus({ status: "stopping" });
    await this.cleanup();
    await sendStatus({ status: "stopped" });
  }

  updateVolume(message: VolumeUpdateMessage): void {
    if (message.originalVolume !== undefined) {
      this.audioGraph?.setOriginalVolume(message.originalVolume);
    }

    if (message.translationVolume !== undefined) {
      this.translatedAudioPlayer?.setVolume(message.translationVolume);
    }
  }

  async cleanup(): Promise<void> {
    this.realtimePeer?.close();
    this.realtimePeer = undefined;

    this.sonioxPeer?.close();
    this.sonioxPeer = undefined;

    this.managedPeer?.close();
    this.managedPeer = undefined;

    this.translatedAudioPlayer?.cleanup();
    this.translatedAudioPlayer = undefined;

    await this.audioGraph?.cleanup().catch(() => undefined);
    this.audioGraph = undefined;

    if (this.tabAudioStream !== undefined) {
      stopMediaStream(this.tabAudioStream);
      this.tabAudioStream = undefined;
    }
  }

  private async forwardTranscript(
    message: Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>
  ): Promise<void> {
    if (!this.subtitleEnabled) {
      return;
    }

    if (message.transcriptType === "source" && !this.showSourceTranscript) {
      return;
    }

    await chrome.runtime.sendMessage(message);
  }
}

const runtime = new OffscreenSessionRuntime();

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isTrustedExtensionSender(sender)) {
    return false;
  }

  if (isOffscreenStartMessage(message)) {
    void runtime.start(message);
    return false;
  }

  if (isOffscreenStopMessage(message)) {
    void runtime.stop(message);
    return false;
  }

  if (isVolumeUpdateMessage(message)) {
    runtime.updateVolume(message);
    return false;
  }

  return false;
});

function isOffscreenStartMessage(message: unknown): message is OffscreenStartMessage {
  if (
    !isRecord(message) ||
    message.type !== "OFFSCREEN_START" ||
    typeof message.tabId !== "number" ||
    !Number.isInteger(message.tabId) ||
    typeof message.streamId !== "string" ||
    message.streamId === "" ||
    !isTargetLanguage(message.targetLanguage) ||
    !isVolume(message.originalVolume) ||
    !isVolume(message.translationVolume) ||
    typeof message.subtitleEnabled !== "boolean" ||
    typeof message.showSourceTranscript !== "boolean"
  ) {
    return false;
  }

  if (message.provider === "openai") {
    return typeof message.clientSecret === "string" && message.clientSecret !== "";
  }

  if (message.provider === "soniox") {
    return typeof message.temporaryApiKey === "string" && message.temporaryApiKey !== "";
  }

  if (message.provider === "managed") {
    return (
      typeof message.sessionUrl === "string" &&
      message.sessionUrl !== "" &&
      typeof message.sessionToken === "string" &&
      message.sessionToken !== "" &&
      typeof message.realtimeOrigin === "string" &&
      message.realtimeOrigin !== "" &&
      (message.managedProvider === "openai" || message.managedProvider === "soniox")
    );
  }

  return false;
}

function isOffscreenStopMessage(message: unknown): message is OffscreenStopMessage {
  return (
    isRecord(message) &&
    message.type === "OFFSCREEN_STOP" &&
    (message.reason === "user" || message.reason === "tab_closed" || message.reason === "error")
  );
}

function isVolumeUpdateMessage(message: unknown): message is VolumeUpdateMessage {
  return (
    isRecord(message) &&
    message.type === "VOLUME_UPDATE" &&
    (message.originalVolume === undefined || isVolume(message.originalVolume)) &&
    (message.translationVolume === undefined || isVolume(message.translationVolume))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVolume(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isTrustedExtensionSender(sender: chrome.runtime.MessageSender | undefined): boolean {
  if (sender === undefined) {
    return true;
  }

  return sender?.id === chrome.runtime.id && sender.tab === undefined;
}

async function sendStatus(message: Omit<SessionStatusMessage, "type">): Promise<void> {
  await chrome.runtime.sendMessage({
    type: "SESSION_STATUS",
    ...message
  });
}

function toErrorStatus(error: unknown): Omit<SessionStatusMessage, "type"> {
  if (error instanceof ExtensionError) {
    return {
      status: "error",
      errorCode: error.code,
      errorMessage: redactError(error)
    };
  }

  return {
    status: "error",
    errorCode: "UNKNOWN_ERROR",
    errorMessage: redactError(error)
  };
}

export {};

import { SONIOX_TRANSCRIBE_WEBSOCKET_URL } from "../lib/constants/endpoints";
import { ExtensionError } from "../lib/errors/errors";
import { redactError, redactSecret } from "../security/redaction";
import type { TargetLanguage } from "../lib/constants/languages";
import type { ExtensionMessage } from "../types/messages";

export const SONIOX_REALTIME_MODEL = "stt-rt-v4";
export const SONIOX_MEDIA_RECORDER_TIMESLICE_MS = 250;

type TranscriptDeltaMessage = Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>;

export type SonioxRealtimeTranslationPeerCallbacks = {
  onTranscriptDelta: (message: TranscriptDeltaMessage) => void | Promise<void>;
  onError: (message: string) => void | Promise<void>;
  onConnected: () => void | Promise<void>;
};

export type StartSonioxRealtimeTranslationPeerOptions = {
  sourceStream: MediaStream;
  temporaryApiKey: string;
  targetLanguage: TargetLanguage;
  callbacks: SonioxRealtimeTranslationPeerCallbacks;
};

type WebSocketFactory = (url: string) => WebSocket;

type MediaRecorderFactory = (
  stream: MediaStream,
  options?: MediaRecorderOptions
) => MediaRecorder;

export class SonioxRealtimeTranslationPeer {
  private webSocket?: WebSocket;
  private mediaRecorder?: MediaRecorder;
  private closedByCaller = false;

  constructor(
    private readonly webSocketFactory: WebSocketFactory = (url) => new WebSocket(url),
    private readonly mediaRecorderFactory: MediaRecorderFactory = (stream, options) =>
      new MediaRecorder(stream, options)
  ) {}

  async start({
    sourceStream,
    temporaryApiKey,
    targetLanguage,
    callbacks
  }: StartSonioxRealtimeTranslationPeerOptions): Promise<void> {
    const [audioTrack] = sourceStream.getAudioTracks();

    if (audioTrack === undefined) {
      throw new ExtensionError("NO_AUDIO_TRACK");
    }

    this.closedByCaller = false;
    const webSocket = this.webSocketFactory(SONIOX_TRANSCRIBE_WEBSOCKET_URL);
    this.webSocket = webSocket;

    webSocket.binaryType = "arraybuffer";
    webSocket.onopen = () => {
      try {
        webSocket.send(JSON.stringify(createSonioxConfig(temporaryApiKey, targetLanguage)));
        this.startRecording(sourceStream, webSocket, callbacks);
        runCallback(() => callbacks.onConnected());
      } catch (error) {
        reportError(callbacks, redactSecret(String(error)));
      }
    };
    webSocket.onmessage = (event) => {
      try {
        for (const message of parseSonioxTranscriptEvent(event.data)) {
          runCallbackWithErrorReporting(
            () => callbacks.onTranscriptDelta(message),
            callbacks
          );
        }
      } catch (error) {
        reportError(callbacks, redactSecret(error instanceof Error ? error.message : String(error)));
      }
    };
    webSocket.onerror = () => {
      if (!this.closedByCaller) {
        reportError(callbacks, "Soniox WebSocket reported an error.");
      }
    };
    webSocket.onclose = () => {
      if (!this.closedByCaller) {
        reportError(callbacks, "Soniox WebSocket closed before the session was stopped.");
      }
    };
  }

  close(): void {
    this.closedByCaller = true;

    if (this.mediaRecorder !== undefined && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    if (this.webSocket !== undefined && this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.send("");
    }

    this.webSocket?.close();
    this.mediaRecorder = undefined;
    this.webSocket = undefined;
  }

  private startRecording(
    sourceStream: MediaStream,
    webSocket: WebSocket,
    callbacks: SonioxRealtimeTranslationPeerCallbacks
  ): void {
    const options = getSupportedMediaRecorderOptions();
    const mediaRecorder = this.mediaRecorderFactory(sourceStream, options);
    this.mediaRecorder = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size === 0 || webSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      void event.data.arrayBuffer().then((buffer) => {
        if (!this.closedByCaller && webSocket.readyState === WebSocket.OPEN) {
          webSocket.send(buffer);
        }
      }).catch((error) => reportError(callbacks, redactSecret(String(error))));
    };
    mediaRecorder.onerror = () => {
      if (!this.closedByCaller) {
        reportError(callbacks, "Tab audio recording failed.");
      }
    };
    mediaRecorder.start(SONIOX_MEDIA_RECORDER_TIMESLICE_MS);
  }
}

export function createSonioxConfig(apiKey: string, targetLanguage: TargetLanguage): Record<string, unknown> {
  return {
    api_key: apiKey,
    model: SONIOX_REALTIME_MODEL,
    audio_format: "auto",
    enable_endpoint_detection: true,
    enable_language_identification: true,
    translation: {
      type: "one_way",
      target_language: targetLanguage
    }
  };
}

export function parseSonioxTranscriptEvent(data: unknown): TranscriptDeltaMessage[] {
  const parsed = parseJsonRecord(data);

  if (typeof parsed.error_code === "string") {
    throw new ExtensionError(
      "DATA_CHANNEL_FAILED",
      redactSecret(`Soniox ${parsed.error_code}: ${String(parsed.error_message ?? "")}`.trim())
    );
  }

  if (!Array.isArray(parsed.tokens)) {
    return [];
  }

  const sourceText = collectFinalText(parsed.tokens, "source");
  const translationText = collectFinalText(parsed.tokens, "translation");
  const messages: TranscriptDeltaMessage[] = [];

  if (sourceText !== "") {
    messages.push({
      type: "TRANSCRIPT_DELTA",
      transcriptType: "source",
      delta: sourceText,
      final: true
    });
  }

  if (translationText !== "") {
    messages.push({
      type: "TRANSCRIPT_DELTA",
      transcriptType: "translation",
      delta: translationText,
      final: true
    });
  }

  return messages;
}

function collectFinalText(tokens: unknown[], transcriptType: "source" | "translation"): string {
  const textParts: string[] = [];

  for (const token of tokens) {
    if (!isSonioxToken(token) || !token.is_final) {
      continue;
    }

    const isTranslation = token.translation_status === "translation";

    if (
      (transcriptType === "translation" && isTranslation) ||
      (transcriptType === "source" && !isTranslation)
    ) {
      textParts.push(token.text);
    }
  }

  return textParts.join("");
}

function parseJsonRecord(data: unknown): Record<string, unknown> {
  if (typeof data !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(data) as unknown;
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch (error) {
    throw new ExtensionError("DATA_CHANNEL_FAILED", redactSecret(String(error)));
  }
}

function isSonioxToken(value: unknown): value is {
  text: string;
  is_final: boolean;
  translation_status?: string;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const token = value as Record<string, unknown>;

  return typeof token.text === "string" && typeof token.is_final === "boolean";
}

function getSupportedMediaRecorderOptions(): MediaRecorderOptions | undefined {
  if (
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
  ) {
    return {
      mimeType: "audio/webm;codecs=opus"
    };
  }

  return undefined;
}

function runCallback(callback: () => void | Promise<void>): void {
  try {
    void Promise.resolve(callback()).catch(() => undefined);
  } catch {
    // Event callbacks must never escape into browser event handlers.
  }
}

function runCallbackWithErrorReporting(
  callback: () => void | Promise<void>,
  callbacks: SonioxRealtimeTranslationPeerCallbacks
): void {
  try {
    void Promise.resolve(callback()).catch((error) => reportError(callbacks, redactError(error)));
  } catch (error) {
    reportError(callbacks, redactError(error));
  }
}

function reportError(
  callbacks: Pick<SonioxRealtimeTranslationPeerCallbacks, "onError">,
  message: string
): void {
  runCallback(() => callbacks.onError(message));
}

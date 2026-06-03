import { ExtensionError } from "../lib/errors/errors";
import { redactError, redactSecret } from "../security/redaction";
import type { ExtensionMessage } from "../types/messages";
import { parseRealtimeTranslationEvent } from "./transcriptEventParser";

type TranscriptDeltaMessage = Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>;
const MANAGED_MEDIA_RECORDER_TIMESLICE_MS = 250;

export type ManagedRealtimeTranslationPeerCallbacks = {
  onRemoteAudioStream: (stream: MediaStream) => void | Promise<void>;
  onTranscriptDelta: (message: TranscriptDeltaMessage) => void | Promise<void>;
  onError: (message: string) => void | Promise<void>;
  onConnected: () => void | Promise<void>;
};

export type StartManagedRealtimeTranslationPeerOptions = {
  sourceStream: MediaStream;
  sessionUrl: string;
  sessionToken: string;
  realtimeOrigin: string;
  callbacks: ManagedRealtimeTranslationPeerCallbacks;
};

export class ManagedRealtimeTranslationPeer {
  private webSocket?: WebSocket;
  private mediaRecorder?: MediaRecorder;
  private closedByCaller = false;
  private recordingStarted = false;

  constructor(
    private readonly webSocketFactory: (url: string) => WebSocket = (url) => new WebSocket(url),
    private readonly mediaRecorderFactory: (
      stream: MediaStream,
      options?: MediaRecorderOptions
    ) => MediaRecorder = (stream, options) => new MediaRecorder(stream, options)
  ) {}

  async start({
    sourceStream,
    sessionUrl,
    sessionToken,
    realtimeOrigin,
    callbacks
  }: StartManagedRealtimeTranslationPeerOptions): Promise<void> {
    const [audioTrack] = sourceStream.getAudioTracks();

    if (audioTrack === undefined) {
      throw new ExtensionError("NO_AUDIO_TRACK");
    }

    this.closedByCaller = false;
    this.recordingStarted = false;
    const webSocket = this.webSocketFactory(createManagedWebSocketUrl(sessionUrl, realtimeOrigin));
    this.webSocket = webSocket;

    webSocket.binaryType = "arraybuffer";
    webSocket.onopen = () => {
      try {
        webSocket.send(JSON.stringify({
          type: "auth",
          protocol_version: 1,
          session_token: sessionToken,
          audio_format: "webm_opus"
        }));
      } catch (error) {
        reportError(callbacks, redactError(error));
      }
    };
    webSocket.onmessage = (event) => {
      if (isManagedReadyEvent(event.data)) {
        this.startRecording(sourceStream, webSocket, callbacks);
        reportConnected(callbacks);
        return;
      }

      const parsed = parseRealtimeTranslationEvent(event.data);

      if (parsed.type === "transcript") {
        runCallbackWithErrorReporting(() => callbacks.onTranscriptDelta(parsed.message), callbacks);
        return;
      }

      if (parsed.type === "error") {
        reportError(callbacks, parsed.errorMessage);
      }
    };
    webSocket.onerror = () => {
      if (!this.closedByCaller) {
        reportError(callbacks, "Managed realtime session reported an error.");
      }
    };
    webSocket.onclose = () => {
      if (!this.closedByCaller) {
        reportError(callbacks, "Managed realtime session closed before the session was stopped.");
      }
    };

    for (const track of sourceStream.getAudioTracks()) {
      track.addEventListener?.("ended", () => this.close(), { once: true });
    }
  }

  close(): void {
    this.closedByCaller = true;

    if (this.mediaRecorder !== undefined && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    this.webSocket?.close();
    this.mediaRecorder = undefined;
    this.webSocket = undefined;
    this.recordingStarted = false;
  }

  private startRecording(
    sourceStream: MediaStream,
    webSocket: WebSocket,
    callbacks: ManagedRealtimeTranslationPeerCallbacks
  ): void {
    if (this.recordingStarted) {
      return;
    }

    const mediaRecorder = this.mediaRecorderFactory(
      sourceStream,
      getSupportedMediaRecorderOptions()
    );
    this.mediaRecorder = mediaRecorder;
    this.recordingStarted = true;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size === 0 || webSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      void event.data.arrayBuffer()
        .then((buffer) => {
          if (!this.closedByCaller && webSocket.readyState === WebSocket.OPEN) {
            webSocket.send(buffer);
          }
        })
        .catch((error) => reportError(callbacks, redactError(error)));
    };
    mediaRecorder.onerror = () => {
      if (!this.closedByCaller) {
        reportError(callbacks, "Tab audio recording failed.");
      }
    };
    mediaRecorder.start(MANAGED_MEDIA_RECORDER_TIMESLICE_MS);
  }
}

export function createManagedWebSocketUrl(sessionUrl: string, allowedOrigin?: string): string {
  let url: URL;

  try {
    url = new URL(sessionUrl);
  } catch {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed service returned an invalid session URL.");
  }

  if (url.protocol !== "wss:") {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed session URL must use wss.");
  }

  if (url.search !== "" || url.hash !== "") {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed session URL must not include query or fragment data.");
  }

  if (allowedOrigin !== undefined && url.origin !== allowedOrigin) {
    throw new ExtensionError("CLIENT_SECRET_FAILED", "Managed session URL origin is not allowed.");
  }

  return url.toString();
}

function isManagedReadyEvent(data: unknown): boolean {
  if (typeof data !== "string") {
    return false;
  }

  try {
    const parsed = JSON.parse(data) as unknown;

    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      return false;
    }

    return parsed.type === "ready" || parsed.type === "session.ready";
  } catch {
    return false;
  }
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

function reportConnected(callbacks: ManagedRealtimeTranslationPeerCallbacks): void {
  runCallback(() => callbacks.onConnected());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  callbacks: ManagedRealtimeTranslationPeerCallbacks
): void {
  try {
    void Promise.resolve(callback()).catch((error) => reportError(callbacks, redactError(error)));
  } catch (error) {
    reportError(callbacks, redactError(error));
  }
}

function reportError(
  callbacks: Pick<ManagedRealtimeTranslationPeerCallbacks, "onError">,
  message: string
): void {
  runCallback(() => callbacks.onError(redactSecret(message)));
}

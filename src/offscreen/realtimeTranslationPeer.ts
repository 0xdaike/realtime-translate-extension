import { OPENAI_TRANSLATION_CALLS_URL } from "../lib/constants/endpoints";
import { ExtensionError } from "../lib/errors/errors";
import { redactError, redactSecret } from "../security/redaction";
import type { ExtensionMessage } from "../types/messages";
import { parseRealtimeTranslationEvent } from "./transcriptEventParser";

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "text">>;

export type RealtimeTranslationPeerCallbacks = {
  onRemoteAudioStream: (stream: MediaStream) => void | Promise<void>;
  onTranscriptDelta: (
    message: Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>
  ) => void | Promise<void>;
  onError: (message: string) => void | Promise<void>;
  onConnected: () => void | Promise<void>;
};

export type StartRealtimeTranslationPeerOptions = {
  sourceStream: MediaStream;
  clientSecret: string;
  callbacks: RealtimeTranslationPeerCallbacks;
};

export class RealtimeTranslationPeer {
  private peerConnection?: RTCPeerConnection;
  private dataChannel?: RTCDataChannel;
  private closedByCaller = false;

  constructor(
    private readonly peerConnectionFactory: () => RTCPeerConnection = () => new RTCPeerConnection(),
    private readonly fetchFn: FetchLike = fetchWithGlobalThis
  ) {}

  async start({
    sourceStream,
    clientSecret,
    callbacks
  }: StartRealtimeTranslationPeerOptions): Promise<void> {
    const peerConnection = this.peerConnectionFactory();
    this.peerConnection = peerConnection;
    this.closedByCaller = false;

    const [audioTrack] = sourceStream.getAudioTracks();

    if (audioTrack === undefined) {
      throw new ExtensionError("NO_AUDIO_TRACK");
    }

    peerConnection.addTrack(audioTrack, sourceStream);

    peerConnection.ontrack = ({ streams }) => {
      const [remoteStream] = streams;

      if (remoteStream !== undefined) {
        runCallbackWithErrorReporting(
          () => callbacks.onRemoteAudioStream(remoteStream),
          callbacks
        );
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        runCallback(() => callbacks.onConnected());
        return;
      }

      if (
        !this.closedByCaller &&
        (peerConnection.connectionState === "disconnected" ||
          peerConnection.connectionState === "failed")
      ) {
        reportError(callbacks, `WebRTC connection ${peerConnection.connectionState}.`);
      }
    };

    const dataChannel = peerConnection.createDataChannel("oai-events");
    this.dataChannel = dataChannel;
    dataChannel.onmessage = ({ data }) => {
      const parsed = parseRealtimeTranslationEvent(data);

      if (parsed.type === "transcript") {
        runCallbackWithErrorReporting(
          () => callbacks.onTranscriptDelta(parsed.message),
          callbacks
        );
        return;
      }

      if (parsed.type === "error") {
        reportError(callbacks, parsed.errorMessage);
      }
    };
    dataChannel.onerror = () => {
      if (!this.closedByCaller) {
        reportError(callbacks, "OpenAI data channel reported an error.");
      }
    };
    dataChannel.onclose = () => {
      if (!this.closedByCaller) {
        reportError(callbacks, "OpenAI data channel closed before the session was stopped.");
      }
    };

    const offer = await createLocalOffer(peerConnection);
    const answerSdp = await exchangeSdpOffer(offer.sdp ?? "", clientSecret, this.fetchFn);

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: answerSdp
    });
  }

  close(): void {
    this.closedByCaller = true;
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = undefined;
    this.peerConnection = undefined;
  }
}

export async function exchangeSdpOffer(
  offerSdp: string,
  clientSecret: string,
  fetchFn: FetchLike = fetchWithGlobalThis
): Promise<string> {
  let response: Awaited<ReturnType<FetchLike>>;

  try {
    response = await fetchFn(OPENAI_TRANSLATION_CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp"
      },
      body: offerSdp
    });
  } catch (error) {
    throw new ExtensionError("WEBRTC_FAILED", redactError(error));
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new ExtensionError(
      "WEBRTC_FAILED",
      redactSecret(`OpenAI returned ${response.status}: ${responseText}`)
    );
  }

  if (responseText.trim() === "") {
    throw new ExtensionError("WEBRTC_FAILED", "OpenAI returned an empty SDP answer.");
  }

  return responseText;
}

async function createLocalOffer(peerConnection: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
  } catch {
    throw new ExtensionError("SDP_OFFER_FAILED");
  }
}

function fetchWithGlobalThis(input: RequestInfo | URL, init?: RequestInit): ReturnType<FetchLike> {
  return globalThis.fetch(input, init);
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
  callbacks: RealtimeTranslationPeerCallbacks
): void {
  try {
    void Promise.resolve(callback()).catch((error) => reportError(callbacks, redactError(error)));
  } catch (error) {
    reportError(callbacks, redactError(error));
  }
}

function reportError(
  callbacks: Pick<RealtimeTranslationPeerCallbacks, "onError">,
  message: string
): void {
  runCallback(() => callbacks.onError(message));
}

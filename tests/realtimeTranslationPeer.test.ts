import { describe, expect, it, vi } from "vitest";
import { OPENAI_TRANSLATION_CALLS_URL } from "../src/lib/constants/endpoints";
import {
  exchangeSdpOffer,
  RealtimeTranslationPeer
} from "../src/offscreen/realtimeTranslationPeer";

describe("exchangeSdpOffer", () => {
  it("posts SDP offers with the client secret bearer token", async () => {
    const clientSecret = "ek_test_client_secret";
    let requestInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;

      return {
        ok: true,
        status: 200,
        text: async () => "answer-sdp"
      };
    });

    await expect(exchangeSdpOffer("offer-sdp", clientSecret, fetchFn)).resolves.toBe("answer-sdp");

    expect(fetchFn).toHaveBeenCalledWith(
      OPENAI_TRANSLATION_CALLS_URL,
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp"
        },
        body: "offer-sdp"
      })
    );
    expect(requestInit?.body).not.toContain(clientSecret);
  });

  it("redacts client secrets from failed SDP exchange errors", async () => {
    const clientSecret = "ek_test_client_secret";
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => `bad ${clientSecret}`
    }));

    await expect(exchangeSdpOffer("offer-sdp", clientSecret, fetchFn)).rejects.toMatchObject({
      code: "WEBRTC_FAILED",
      message: "OpenAI returned 401: bad ek_REDACTED"
    });
  });

  it("redacts client secrets from SDP fetch failures", async () => {
    const clientSecret = "ek_test_client_secret";
    const fetchFn = vi.fn(async () => {
      throw new Error(`network failed ${clientSecret}`);
    });

    await expect(exchangeSdpOffer("offer-sdp", clientSecret, fetchFn)).rejects.toMatchObject({
      code: "WEBRTC_FAILED",
      message: "network failed ek_REDACTED"
    });
  });

  it("rejects empty SDP answers", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => ""
    }));

    await expect(exchangeSdpOffer("offer-sdp", "ek_test_client_secret", fetchFn)).rejects.toMatchObject({
      code: "WEBRTC_FAILED",
      message: "OpenAI returned an empty SDP answer."
    });
  });

  it("reports unexpected WebRTC disconnects as errors", async () => {
    const fakePeerConnection = new FakePeerConnection();
    const callbacks = createCallbacks();
    const peer = new RealtimeTranslationPeer(
      () => fakePeerConnection as unknown as RTCPeerConnection,
      createSuccessfulSdpFetch()
    );

    await peer.start({
      sourceStream: createSourceStream(),
      clientSecret: "ek_test_client_secret",
      callbacks
    });
    fakePeerConnection.emitConnectionState("disconnected");

    expect(callbacks.onError).toHaveBeenCalledWith("WebRTC connection disconnected.");
  });

  it("reports unexpected data channel closes as errors", async () => {
    const fakePeerConnection = new FakePeerConnection();
    const callbacks = createCallbacks();
    const peer = new RealtimeTranslationPeer(
      () => fakePeerConnection as unknown as RTCPeerConnection,
      createSuccessfulSdpFetch()
    );

    await peer.start({
      sourceStream: createSourceStream(),
      clientSecret: "ek_test_client_secret",
      callbacks
    });
    fakePeerConnection.dataChannel.emitClose();

    expect(callbacks.onError).toHaveBeenCalledWith(
      "OpenAI data channel closed before the session was stopped."
    );
  });

  it("reports remote translated audio playback failures as errors", async () => {
    const fakePeerConnection = new FakePeerConnection();
    const callbacks = createCallbacks();
    callbacks.onRemoteAudioStream = vi.fn(async () => {
      throw new Error("autoplay failed ek_test_client_secret");
    });
    const peer = new RealtimeTranslationPeer(
      () => fakePeerConnection as unknown as RTCPeerConnection,
      createSuccessfulSdpFetch()
    );

    await peer.start({
      sourceStream: createSourceStream(),
      clientSecret: "ek_test_client_secret",
      callbacks
    });
    fakePeerConnection.emitTrack({} as MediaStream);
    await Promise.resolve();
    await Promise.resolve();

    expect(callbacks.onError).toHaveBeenCalledWith("autoplay failed ek_REDACTED");
  });

  it("does not report errors when callers close the peer intentionally", async () => {
    const fakePeerConnection = new FakePeerConnection();
    const callbacks = createCallbacks();
    const peer = new RealtimeTranslationPeer(
      () => fakePeerConnection as unknown as RTCPeerConnection,
      createSuccessfulSdpFetch()
    );

    await peer.start({
      sourceStream: createSourceStream(),
      clientSecret: "ek_test_client_secret",
      callbacks
    });
    peer.close();

    expect(callbacks.onError).not.toHaveBeenCalled();
  });
});

class FakeDataChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;

  close(): void {
    this.emitClose();
  }

  emitClose(): void {
    this.onclose?.(new Event("close"));
  }
}

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = "new";
  readonly dataChannel = new FakeDataChannel();
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  onconnectionstatechange: ((event: Event) => void) | null = null;

  addTrack = vi.fn();
  createDataChannel = vi.fn(() => this.dataChannel as unknown as RTCDataChannel);
  createOffer = vi.fn(async () => ({
    type: "offer" as const,
    sdp: "offer-sdp"
  }));
  setLocalDescription = vi.fn(async () => undefined);
  setRemoteDescription = vi.fn(async () => undefined);

  close(): void {
    this.connectionState = "closed";
    this.onconnectionstatechange?.(new Event("connectionstatechange"));
  }

  emitConnectionState(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    this.onconnectionstatechange?.(new Event("connectionstatechange"));
  }

  emitTrack(stream: MediaStream): void {
    this.ontrack?.({
      streams: [stream]
    } as unknown as RTCTrackEvent);
  }
}

function createCallbacks() {
  return {
    onRemoteAudioStream: vi.fn(),
    onTranscriptDelta: vi.fn(),
    onError: vi.fn(),
    onConnected: vi.fn()
  };
}

function createSourceStream(): MediaStream {
  return {
    getAudioTracks: () => [{} as MediaStreamTrack]
  } as MediaStream;
}

function createSuccessfulSdpFetch() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => "answer-sdp"
  }));
}

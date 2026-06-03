import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createManagedWebSocketUrl,
  ManagedRealtimeTranslationPeer
} from "../src/offscreen/managedRealtimeTranslationPeer";

describe("createManagedWebSocketUrl", () => {
  it("accepts wss managed session URLs without appending tokens", () => {
    expect(
      createManagedWebSocketUrl(
        "wss://managed.example.test/realtime",
        "wss://managed.example.test"
      )
    ).toBe("wss://managed.example.test/realtime");
  });

  it("rejects non-wss managed session URLs", () => {
    expect(() => createManagedWebSocketUrl("https://managed.example.test/realtime")).toThrow(
      "Managed session URL must use wss."
    );
  });

  it("rejects query and fragment data in managed session URLs", () => {
    expect(() => createManagedWebSocketUrl("wss://managed.example.test/realtime?token=abc")).toThrow(
      "Managed session URL must not include query or fragment data."
    );
    expect(() => createManagedWebSocketUrl("wss://managed.example.test/realtime#token")).toThrow(
      "Managed session URL must not include query or fragment data."
    );
  });

  it("rejects managed session URLs outside the allowed origin", () => {
    expect(() =>
      createManagedWebSocketUrl(
        "wss://evil.example.test/realtime",
        "wss://managed.example.test"
      )
    ).toThrow("Managed session URL origin is not allowed.");
  });
});

describe("ManagedRealtimeTranslationPeer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authenticates first and waits for server ready before streaming audio", async () => {
    stubMediaGlobals();
    const socket = new FakeWebSocket();
    const recorders: FakeMediaRecorder[] = [];
    const callbacks = createCallbacks();
    const peer = new ManagedRealtimeTranslationPeer(
      () => socket as unknown as WebSocket,
      (_stream, options) => {
        expect(options).toEqual({
          mimeType: "audio/webm;codecs=opus"
        });
        const recorder = new FakeMediaRecorder();
        recorders.push(recorder);
        return recorder as unknown as MediaRecorder;
      }
    );

    await peer.start({
      sourceStream: createSourceStream(),
      sessionUrl: "wss://managed.example.test/realtime",
      sessionToken: "managed-session-token-123456789",
      realtimeOrigin: "wss://managed.example.test",
      callbacks
    });

    socket.emitOpen();
    expect(socket.sent).toEqual([
      JSON.stringify({
        type: "auth",
        protocol_version: 1,
        session_token: "managed-session-token-123456789",
        audio_format: "webm_opus"
      })
    ]);
    expect(recorders).toHaveLength(0);
    expect(callbacks.onConnected).not.toHaveBeenCalled();

    socket.emitMessage(JSON.stringify({
      type: "session.ready"
    }));

    expect(recorders).toHaveLength(1);
    expect(recorders[0]?.start).toHaveBeenCalledWith(250);
    expect(callbacks.onConnected).toHaveBeenCalledTimes(1);

    recorders[0]?.emitChunk("audio-data");
    await flushPromises();

    expect(socket.sent).toHaveLength(2);
    expect(socket.sent[1]).toBeInstanceOf(ArrayBuffer);
  });

  it("forwards transcript messages from the managed server", async () => {
    stubMediaGlobals();
    const socket = new FakeWebSocket();
    const callbacks = createCallbacks();
    const peer = new ManagedRealtimeTranslationPeer(
      () => socket as unknown as WebSocket,
      () => new FakeMediaRecorder() as unknown as MediaRecorder
    );

    await peer.start({
      sourceStream: createSourceStream(),
      sessionUrl: "wss://managed.example.test/realtime",
      sessionToken: "managed-session-token-123456789",
      realtimeOrigin: "wss://managed.example.test",
      callbacks
    });

    socket.emitMessage(JSON.stringify({
      type: "session.output_transcript.delta",
      delta: "hello"
    }));

    expect(callbacks.onTranscriptDelta).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "TRANSCRIPT_DELTA",
        transcriptType: "translation",
        delta: "hello"
      })
    );
  });

  it("stops recorder and closes socket without reporting caller-initiated close as an error", async () => {
    stubMediaGlobals();
    const socket = new FakeWebSocket();
    const recorder = new FakeMediaRecorder();
    const callbacks = createCallbacks();
    const peer = new ManagedRealtimeTranslationPeer(
      () => socket as unknown as WebSocket,
      () => recorder as unknown as MediaRecorder
    );

    await peer.start({
      sourceStream: createSourceStream(),
      sessionUrl: "wss://managed.example.test/realtime",
      sessionToken: "managed-session-token-123456789",
      realtimeOrigin: "wss://managed.example.test",
      callbacks
    });
    socket.emitMessage(JSON.stringify({
      type: "ready"
    }));

    peer.close();

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
});

class FakeWebSocket {
  binaryType: BinaryType = "blob";
  readyState = 1;
  sent: unknown[] = [];
  onopen?: () => void;
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  onclose?: () => void;

  send = vi.fn((data: unknown) => {
    this.sent.push(data);
  });

  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });

  emitOpen(): void {
    this.onopen?.();
  }

  emitMessage(data: string): void {
    this.onmessage?.({
      data
    } as MessageEvent);
  }
}

class FakeMediaRecorder {
  state: RecordingState = "inactive";
  ondataavailable?: (event: BlobEvent) => void;
  onerror?: () => void;

  start = vi.fn(() => {
    this.state = "recording";
  });

  stop = vi.fn(() => {
    this.state = "inactive";
  });

  emitChunk(text: string): void {
    this.ondataavailable?.({
      data: new Blob([text])
    } as BlobEvent);
  }
}

function createSourceStream(): MediaStream {
  return {
    getAudioTracks: () => [
      {
        addEventListener: vi.fn()
      }
    ]
  } as unknown as MediaStream;
}

function createCallbacks() {
  return {
    onConnected: vi.fn(),
    onError: vi.fn(),
    onRemoteAudioStream: vi.fn(),
    onTranscriptDelta: vi.fn()
  };
}

function stubMediaGlobals(): void {
  vi.stubGlobal("WebSocket", {
    OPEN: 1
  });
  vi.stubGlobal("MediaRecorder", {
    isTypeSupported: vi.fn(() => true)
  });
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

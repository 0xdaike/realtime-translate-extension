import { describe, expect, it, vi } from "vitest";
import { resolveTabAudioStream, stopMediaStream } from "../src/offscreen/tabAudioStream";

function createMediaStream(audioTrackCount: number) {
  const tracks = Array.from({ length: audioTrackCount }, () => ({
    stop: vi.fn()
  }));

  return {
    getAudioTracks: () => tracks,
    getTracks: () => tracks
  } as unknown as MediaStream;
}

describe("resolveTabAudioStream", () => {
  it("resolves a stream with audio tracks", async () => {
    const stream = createMediaStream(1);
    const getUserMedia = vi.fn(async () => stream);

    await expect(resolveTabAudioStream("stream-id", getUserMedia)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({
          mandatory: expect.objectContaining({
            chromeMediaSource: "tab",
            chromeMediaSourceId: "stream-id"
          })
        }),
        video: false
      })
    );
  });

  it("stops tracks and rejects when no audio track exists", async () => {
    const stream = createMediaStream(0);
    const getUserMedia = vi.fn(async () => stream);

    await expect(resolveTabAudioStream("stream-id", getUserMedia)).rejects.toMatchObject({
      code: "NO_AUDIO_TRACK"
    });
  });
});

describe("stopMediaStream", () => {
  it("stops every track", () => {
    const stream = createMediaStream(2);
    const tracks = stream.getTracks();

    stopMediaStream(stream);

    expect(tracks[0]?.stop).toHaveBeenCalledTimes(1);
    expect(tracks[1]?.stop).toHaveBeenCalledTimes(1);
  });
});

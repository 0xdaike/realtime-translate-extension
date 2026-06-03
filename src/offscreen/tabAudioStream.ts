import { ExtensionError } from "../lib/errors/errors";

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

export async function resolveTabAudioStream(
  streamId: string,
  getUserMedia: GetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
): Promise<MediaStream> {
  try {
    const stream = await getUserMedia(createTabAudioConstraints(streamId));

    if (stream.getAudioTracks().length === 0) {
      stopMediaStream(stream);
      throw new ExtensionError("NO_AUDIO_TRACK");
    }

    return stream;
  } catch (error) {
    if (error instanceof ExtensionError) {
      throw error;
    }

    throw new ExtensionError("TAB_CAPTURE_FAILED", "Could not resolve tab audio stream.");
  }
}

export function stopMediaStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function createTabAudioConstraints(streamId: string): MediaStreamConstraints {
  return {
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    } as MediaTrackConstraints,
    video: false
  };
}

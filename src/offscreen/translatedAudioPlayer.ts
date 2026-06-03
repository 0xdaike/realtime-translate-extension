import { ExtensionError } from "../lib/errors/errors";
import { clampVolume } from "./audioGraph";

export class TranslatedAudioPlayer {
  private audioElement?: HTMLAudioElement;

  async playStream(stream: MediaStream, volume: number): Promise<void> {
    this.cleanup();

    const audioElement = new Audio();
    audioElement.autoplay = true;
    audioElement.srcObject = stream;
    audioElement.volume = clampVolume(volume);
    this.audioElement = audioElement;

    try {
      await audioElement.play();
    } catch {
      throw new ExtensionError("AUTOPLAY_BLOCKED");
    }
  }

  setVolume(volume: number): void {
    if (this.audioElement !== undefined) {
      this.audioElement.volume = clampVolume(volume);
    }
  }

  cleanup(): void {
    if (this.audioElement === undefined) {
      return;
    }

    this.audioElement.pause();
    this.audioElement.srcObject = null;
    this.audioElement.remove();
    this.audioElement = undefined;
  }
}

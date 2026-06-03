export class TabAudioGraph {
  private readonly audioContext: AudioContext;
  private readonly source: MediaStreamAudioSourceNode;
  private readonly originalGain: GainNode;

  constructor(tabAudioStream: MediaStream, originalVolume: number) {
    this.audioContext = new AudioContext();
    this.source = this.audioContext.createMediaStreamSource(tabAudioStream);
    this.originalGain = this.audioContext.createGain();
    this.setOriginalVolume(originalVolume);
    this.source.connect(this.originalGain);
    this.originalGain.connect(this.audioContext.destination);
  }

  setOriginalVolume(volume: number): void {
    this.originalGain.gain.value = clampVolume(volume);
  }

  async resume(): Promise<void> {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async cleanup(): Promise<void> {
    this.source.disconnect();
    this.originalGain.disconnect();

    if (this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }
  }
}

export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }

  return Math.min(1, Math.max(0, volume));
}

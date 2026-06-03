import type { TargetLanguage } from "../lib/constants/languages";
import {
  appendTranscriptDelta,
  EMPTY_TRANSCRIPT_BUFFER,
  getVisibleTranscriptLines,
  type TranscriptBufferState
} from "./transcriptBuffer";
import { OVERLAY_STYLES } from "./overlayStyles";
import type { ExtensionMessage, SessionStatus } from "../types/messages";

export const OVERLAY_HOST_ID = "personal-realtime-interpreter-overlay";

type OverlayOptions = {
  targetLanguage: TargetLanguage;
  showSourceTranscript: boolean;
  maxLines?: number;
};

type TranscriptDeltaMessage = Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>;

const STATUS_LABELS: Record<SessionStatus, string> = {
  idle: "Idle",
  preparing: "Preparing",
  capturing: "Capturing tab audio",
  connecting: "Connecting",
  connected: "Live translation",
  stopping: "Stopping",
  stopped: "Stopped",
  error: "Error"
};

export class SubtitleOverlay {
  private readonly host: HTMLDivElement;
  private readonly statusElement: HTMLDivElement;
  private readonly sourceElement: HTMLDivElement;
  private readonly translationElement: HTMLDivElement;
  private readonly emptyElement: HTMLDivElement;
  private readonly maxLines: number;
  private buffer: TranscriptBufferState = EMPTY_TRANSCRIPT_BUFFER;

  constructor(private readonly options: OverlayOptions, doc: Document = document) {
    doc.getElementById(OVERLAY_HOST_ID)?.remove();

    this.maxLines = options.maxLines ?? 3;
    this.host = doc.createElement("div");
    this.host.id = OVERLAY_HOST_ID;

    const shadow = this.host.attachShadow({ mode: "closed" });
    const style = doc.createElement("style");
    style.textContent = OVERLAY_STYLES;

    const root = doc.createElement("div");
    root.className = "pri-overlay";

    const card = doc.createElement("div");
    card.className = "pri-card";

    this.statusElement = doc.createElement("div");
    this.statusElement.className = "pri-status";
    this.statusElement.textContent = `Ready for ${options.targetLanguage.toUpperCase()}`;

    this.sourceElement = doc.createElement("div");
    this.sourceElement.className = "pri-source";

    this.translationElement = doc.createElement("div");
    this.translationElement.className = "pri-translation";

    this.emptyElement = doc.createElement("div");
    this.emptyElement.className = "pri-empty";
    this.emptyElement.textContent = "Listening for translated speech...";

    card.append(this.statusElement, this.sourceElement, this.translationElement, this.emptyElement);
    root.append(card);
    shadow.append(style, root);
    doc.documentElement.append(this.host);
  }

  updateStatus(status: SessionStatus, errorMessage?: string): void {
    this.statusElement.textContent = errorMessage ?? STATUS_LABELS[status];
  }

  appendTranscript(message: TranscriptDeltaMessage): void {
    if (message.transcriptType === "source" && !this.options.showSourceTranscript) {
      return;
    }

    this.buffer = appendTranscriptDelta(
      this.buffer,
      message.transcriptType,
      message.delta,
      message.final,
      this.maxLines
    );
    this.renderTranscript();
  }

  remove(): void {
    this.host.remove();
  }

  private renderTranscript(): void {
    const sourceLines = getVisibleTranscriptLines(this.buffer, "source", this.maxLines);
    const translationLines = getVisibleTranscriptLines(this.buffer, "translation", this.maxLines);

    this.sourceElement.hidden = !this.options.showSourceTranscript || sourceLines.length === 0;
    this.sourceElement.textContent = sourceLines.join("\n");
    this.translationElement.textContent = translationLines.join("\n");
    this.emptyElement.hidden = translationLines.length > 0 || sourceLines.length > 0;
  }
}

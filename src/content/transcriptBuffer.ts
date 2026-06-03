import type { TranscriptType } from "../types/messages";

export type TranscriptBufferState = {
  sourceLines: string[];
  translationLines: string[];
  currentSource: string;
  currentTranslation: string;
};

export const EMPTY_TRANSCRIPT_BUFFER: TranscriptBufferState = {
  sourceLines: [],
  translationLines: [],
  currentSource: "",
  currentTranslation: ""
};

export function appendTranscriptDelta(
  state: TranscriptBufferState,
  transcriptType: TranscriptType,
  delta: string,
  final = false,
  maxLines = 3
): TranscriptBufferState {
  if (delta.length === 0) {
    return state;
  }

  if (transcriptType === "source") {
    const nextSource = `${state.currentSource}${delta}`;
    return {
      ...state,
      sourceLines: final ? trimLines([...state.sourceLines, nextSource], maxLines) : state.sourceLines,
      currentSource: final ? "" : nextSource
    };
  }

  const nextTranslation = `${state.currentTranslation}${delta}`;
  return {
    ...state,
    translationLines: final
      ? trimLines([...state.translationLines, nextTranslation], maxLines)
      : state.translationLines,
    currentTranslation: final ? "" : nextTranslation
  };
}

export function getVisibleTranscriptLines(
  state: TranscriptBufferState,
  transcriptType: TranscriptType,
  maxLines = 3
): string[] {
  const lines =
    transcriptType === "source"
      ? [...state.sourceLines, state.currentSource]
      : [...state.translationLines, state.currentTranslation];

  return trimLines(
    lines.map((line) => line.trim()).filter((line) => line.length > 0),
    maxLines
  );
}

function trimLines(lines: string[], maxLines: number): string[] {
  return lines.slice(Math.max(0, lines.length - maxLines));
}

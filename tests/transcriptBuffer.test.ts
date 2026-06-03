import { describe, expect, it } from "vitest";
import {
  appendTranscriptDelta,
  EMPTY_TRANSCRIPT_BUFFER,
  getVisibleTranscriptLines
} from "../src/content/transcriptBuffer";

describe("transcript buffer", () => {
  it("builds partial and final translated lines without mixing source text", () => {
    let state = EMPTY_TRANSCRIPT_BUFFER;

    state = appendTranscriptDelta(state, "translation", "こん", false);
    state = appendTranscriptDelta(state, "translation", "にちは", true);
    state = appendTranscriptDelta(state, "source", "hello", true);

    expect(getVisibleTranscriptLines(state, "translation")).toEqual(["こんにちは"]);
    expect(getVisibleTranscriptLines(state, "source")).toEqual(["hello"]);
  });

  it("keeps only the most recent visible lines", () => {
    let state = EMPTY_TRANSCRIPT_BUFFER;

    state = appendTranscriptDelta(state, "translation", "one", true, 2);
    state = appendTranscriptDelta(state, "translation", "two", true, 2);
    state = appendTranscriptDelta(state, "translation", "three", true, 2);

    expect(getVisibleTranscriptLines(state, "translation", 2)).toEqual(["two", "three"]);
  });
});

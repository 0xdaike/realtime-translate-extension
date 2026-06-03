import { describe, expect, it, vi } from "vitest";
import { parseRealtimeTranslationEvent } from "../src/offscreen/transcriptEventParser";

describe("parseRealtimeTranslationEvent", () => {
  it("parses translated transcript deltas", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);

    expect(
      parseRealtimeTranslationEvent(
        JSON.stringify({
          type: "session.output_transcript.delta",
          delta: "こんにちは"
        })
      )
    ).toEqual({
      type: "transcript",
      message: {
        type: "TRANSCRIPT_DELTA",
        transcriptType: "translation",
        delta: "こんにちは",
        final: false,
        timestampMs: 123
      }
    });
  });

  it("parses source transcript deltas", () => {
    const parsed = parseRealtimeTranslationEvent({
      type: "session.input_transcript.delta",
      delta: "hello"
    });

    expect(parsed).toMatchObject({
      type: "transcript",
      message: {
        transcriptType: "source",
        delta: "hello"
      }
    });
  });

  it("redacts secret-like values from error events", () => {
    const fakeApiKey = ["sk", "parser-error-123456789"].join("-");

    expect(
      parseRealtimeTranslationEvent({
        type: "error",
        error: {
          message: `bad ${fakeApiKey}`
        }
      })
    ).toEqual({
      type: "error",
      errorMessage: "bad sk-REDACTED"
    });
  });

  it("ignores malformed events", () => {
    expect(parseRealtimeTranslationEvent("not-json")).toEqual({ type: "ignored" });
    expect(parseRealtimeTranslationEvent({ type: "unknown" })).toEqual({ type: "ignored" });
  });
});

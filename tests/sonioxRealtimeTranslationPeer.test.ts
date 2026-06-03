import { describe, expect, it } from "vitest";
import {
  SONIOX_REALTIME_MODEL,
  createSonioxConfig,
  parseSonioxTranscriptEvent
} from "../src/offscreen/sonioxRealtimeTranslationPeer";

describe("createSonioxConfig", () => {
  it("creates a one-way translation config for temporary WebSocket keys", () => {
    expect(createSonioxConfig("temp:temporary-key-123456789", "ja")).toEqual({
      api_key: "temp:temporary-key-123456789",
      model: SONIOX_REALTIME_MODEL,
      audio_format: "auto",
      enable_endpoint_detection: true,
      enable_language_identification: true,
      translation: {
        type: "one_way",
        target_language: "ja"
      }
    });
  });
});

describe("parseSonioxTranscriptEvent", () => {
  it("maps final Soniox source and translation tokens to transcript deltas", () => {
    expect(
      parseSonioxTranscriptEvent(
        JSON.stringify({
          tokens: [
            { text: "Hello", is_final: true, translation_status: "original" },
            { text: "こんにちは", is_final: true, translation_status: "translation" },
            { text: " ignored", is_final: false, translation_status: "translation" }
          ]
        })
      )
    ).toEqual([
      {
        type: "TRANSCRIPT_DELTA",
        transcriptType: "source",
        delta: "Hello",
        final: true
      },
      {
        type: "TRANSCRIPT_DELTA",
        transcriptType: "translation",
        delta: "こんにちは",
        final: true
      }
    ]);
  });

  it("throws a redacted extension error for Soniox error responses", () => {
    expect(() =>
      parseSonioxTranscriptEvent(
        JSON.stringify({
          error_code: "unauthenticated",
          error_message: "bad temp:temporary-key-123456789"
        })
      )
    ).toThrow("Soniox unauthenticated: bad temp:REDACTED");
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_TARGET_LANGUAGE,
  TARGET_LANGUAGES,
  isTargetLanguage
} from "../src/lib/constants/languages";

describe("target languages", () => {
  it("accepts every supported language code", () => {
    for (const language of TARGET_LANGUAGES) {
      expect(isTargetLanguage(language.code)).toBe(true);
    }
  });

  it("rejects unsupported values", () => {
    expect(isTargetLanguage("")).toBe(false);
    expect(isTargetLanguage("nl")).toBe(false);
    expect(isTargetLanguage("JA")).toBe(false);
    expect(isTargetLanguage(null)).toBe(false);
  });

  it("defaults to Japanese", () => {
    expect(DEFAULT_TARGET_LANGUAGE).toBe("ja");
  });
});

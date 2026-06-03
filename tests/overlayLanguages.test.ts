import { describe, expect, it } from "vitest";
import { OVERLAY_TARGET_LANGUAGE_CODES, isOverlayTargetLanguage } from "../src/content/overlayLanguages";
import { TARGET_LANGUAGES } from "../src/lib/constants/languages";

describe("overlay language validation", () => {
  it("matches the shared target language constants", () => {
    expect(OVERLAY_TARGET_LANGUAGE_CODES).toEqual(
      TARGET_LANGUAGES.map((language) => language.code)
    );
  });

  it("rejects unsupported language codes", () => {
    expect(isOverlayTargetLanguage("th")).toBe(false);
    expect(isOverlayTargetLanguage("xx")).toBe(false);
  });
});

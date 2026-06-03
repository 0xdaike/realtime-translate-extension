export const OVERLAY_TARGET_LANGUAGE_CODES = [
  "ja",
  "en",
  "zh",
  "ko",
  "es",
  "pt",
  "fr",
  "de",
  "ru",
  "hi",
  "id",
  "vi",
  "it"
] as const;

const OVERLAY_TARGET_LANGUAGE_CODE_SET = new Set<string>(OVERLAY_TARGET_LANGUAGE_CODES);

export function isOverlayTargetLanguage(value: unknown): boolean {
  return typeof value === "string" && OVERLAY_TARGET_LANGUAGE_CODE_SET.has(value);
}

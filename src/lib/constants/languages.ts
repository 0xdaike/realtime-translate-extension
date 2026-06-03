export const TARGET_LANGUAGES = [
  { code: "ja", labelJa: "日本語", labelEn: "Japanese" },
  { code: "en", labelJa: "英語", labelEn: "English" },
  { code: "zh", labelJa: "中国語", labelEn: "Chinese" },
  { code: "ko", labelJa: "韓国語", labelEn: "Korean" },
  { code: "es", labelJa: "スペイン語", labelEn: "Spanish" },
  { code: "pt", labelJa: "ポルトガル語", labelEn: "Portuguese" },
  { code: "fr", labelJa: "フランス語", labelEn: "French" },
  { code: "de", labelJa: "ドイツ語", labelEn: "German" },
  { code: "ru", labelJa: "ロシア語", labelEn: "Russian" },
  { code: "hi", labelJa: "ヒンディー語", labelEn: "Hindi" },
  { code: "id", labelJa: "インドネシア語", labelEn: "Indonesian" },
  { code: "vi", labelJa: "ベトナム語", labelEn: "Vietnamese" },
  { code: "it", labelJa: "イタリア語", labelEn: "Italian" }
] as const;

export type TargetLanguage = (typeof TARGET_LANGUAGES)[number]["code"];

export const DEFAULT_TARGET_LANGUAGE: TargetLanguage = "ja";

const TARGET_LANGUAGE_CODES = new Set<string>(
  TARGET_LANGUAGES.map((language) => language.code)
);

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return typeof value === "string" && TARGET_LANGUAGE_CODES.has(value);
}

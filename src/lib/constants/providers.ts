export const TRANSLATION_PROVIDERS = [
  { id: "openai", code: "openai", label: "OpenAI" },
  { id: "soniox", code: "soniox", label: "Soniox" }
] as const;

export type TranslationProvider = (typeof TRANSLATION_PROVIDERS)[number]["id"];

export const DEFAULT_TRANSLATION_PROVIDER: TranslationProvider = "openai";

const TRANSLATION_PROVIDER_CODES = new Set<string>(
  TRANSLATION_PROVIDERS.map((provider) => provider.id)
);

export function isTranslationProvider(value: unknown): value is TranslationProvider {
  return typeof value === "string" && TRANSLATION_PROVIDER_CODES.has(value);
}

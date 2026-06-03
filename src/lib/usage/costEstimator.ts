import type { TranslationProvider } from "../constants/providers";

export const GPT_REALTIME_TRANSLATE_USD_PER_MIN = 0.034;
export const SONIOX_REALTIME_TRANSLATE_USD_PER_MIN = 0.002;

export function estimateRealtimeTranslateCostUsd(
  seconds: number,
  provider: TranslationProvider = "openai"
): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }

  const rate =
    provider === "soniox"
      ? SONIOX_REALTIME_TRANSLATE_USD_PER_MIN
      : GPT_REALTIME_TRANSLATE_USD_PER_MIN;

  return (seconds / 60) * rate;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
}

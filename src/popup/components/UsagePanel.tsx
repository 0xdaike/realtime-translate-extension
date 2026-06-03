import {
  estimateRealtimeTranslateCostUsd,
  formatUsd
} from "../../lib/usage/costEstimator";
import type { TranslationProvider } from "../../lib/constants/providers";
import type { ServiceMode } from "../../lib/constants/serviceModes";

type UsagePanelProps = {
  serviceMode: ServiceMode;
  provider: TranslationProvider;
  currentSessionSeconds: number;
  todaySeconds: number;
  monthSeconds: number;
};

export function UsagePanel({
  serviceMode,
  provider,
  currentSessionSeconds,
  todaySeconds,
  monthSeconds
}: UsagePanelProps) {
  const monthCostLabel =
    serviceMode === "managed"
      ? "Managed plan"
      : formatUsd(estimateRealtimeTranslateCostUsd(monthSeconds, provider));

  return (
    <section className="usage-card">
      <div>
        <span>今回</span>
        <strong>{formatMinutes(currentSessionSeconds)}</strong>
      </div>
      <div>
        <span>今日</span>
        <strong>{formatMinutes(todaySeconds)}</strong>
      </div>
      <div>
        <span>今月の目安</span>
        <strong>{monthCostLabel}</strong>
      </div>
      <p>
        {serviceMode === "managed"
          ? "Managedプランの実際の利用量と請求は自社API側の管理画面で確認してください。"
          : "推定値です。実際の請求は選択中プロバイダーの利用状況画面で確認してください。"}
      </p>
    </section>
  );
}

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}分`;
}

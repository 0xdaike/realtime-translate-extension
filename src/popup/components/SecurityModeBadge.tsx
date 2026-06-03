import type { KeyAvailability } from "../../security/keyVault";
import type { KeyStorageMode } from "../../security/keyStorageMode";

type SecurityModeBadgeProps = {
  mode: KeyStorageMode;
  keyAvailability: KeyAvailability;
};

export function SecurityModeBadge({ mode, keyAvailability }: SecurityModeBadgeProps) {
  const modeLabel = mode === "encrypted_local" ? "暗号化ローカル" : "セッション限定";
  const availabilityLabel =
    keyAvailability === "available"
      ? "利用可能"
      : keyAvailability === "locked"
        ? "ロック中"
        : "未設定";

  return (
    <div className={`security-badge security-badge-${keyAvailability}`}>
      <span>{modeLabel}</span>
      <strong>{availabilityLabel}</strong>
    </div>
  );
}

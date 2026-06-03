import type { KeyStorageMode } from "../../security/keyStorageMode";

type SecurityModeSelectProps = {
  mode: KeyStorageMode;
  disabled?: boolean;
  onModeChange: (mode: KeyStorageMode) => void;
};

export function SecurityModeSelect({
  mode,
  disabled = false,
  onModeChange
}: SecurityModeSelectProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Security Mode</p>
        <h2>APIキー保存モード</h2>
      </div>

      <label className="field">
        <span>保存モード</span>
        <select
          value={mode}
          disabled={disabled}
          onChange={(event) => onModeChange(event.currentTarget.value as KeyStorageMode)}
        >
          <option value="session_only">セッション限定（推奨）</option>
          <option value="encrypted_local">暗号化してローカル保存</option>
        </select>
      </label>

      <p className="muted">
        セッション限定ではブラウザ再起動や拡張リロードでキーが消えます。暗号化ローカル保存は便利ですが、端末やブラウザプロファイルが侵害された場合のリスクは残ります。
      </p>
    </section>
  );
}

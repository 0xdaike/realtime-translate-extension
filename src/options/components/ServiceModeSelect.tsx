import { SERVICE_MODES } from "../../lib/constants/serviceModes";
import type { UserSettings } from "../../types/settings";

type ServiceModeSelectProps = {
  settings: UserSettings;
  disabled?: boolean;
  onSettingsChange: (settings: UserSettings) => void;
};

export function ServiceModeSelect({
  settings,
  disabled = false,
  onSettingsChange
}: ServiceModeSelectProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Service Mode</p>
        <h2>利用形態</h2>
      </div>

      <label className="field">
        <span>利用形態</span>
        <select
          value={settings.serviceMode}
          disabled={disabled}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              serviceMode: event.currentTarget.value as UserSettings["serviceMode"]
            })
          }
        >
          {SERVICE_MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>

      <p className="muted">
        {SERVICE_MODES.find((mode) => mode.id === settings.serviceMode)?.description}
      </p>
    </section>
  );
}

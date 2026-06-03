import { TARGET_LANGUAGES } from "../../lib/constants/languages";
import { TRANSLATION_PROVIDERS } from "../../lib/constants/providers";
import type { UserSettings } from "../../types/settings";

type DefaultSettingsFormProps = {
  settings: UserSettings;
  disabled?: boolean;
  onSettingsChange: (settings: UserSettings) => void;
};

export function DefaultSettingsForm({
  settings,
  disabled = false,
  onSettingsChange
}: DefaultSettingsFormProps) {
  const isSonioxProvider = settings.translationProvider === "soniox";

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Defaults</p>
        <h2>翻訳の既定設定</h2>
      </div>

      <label className="field">
        <span>翻訳エンジン</span>
        <select
          value={settings.translationProvider}
          disabled={disabled}
          onChange={(event) => {
            const translationProvider = event.currentTarget.value as UserSettings["translationProvider"];
            onSettingsChange({
              ...settings,
              translationProvider,
              subtitleEnabled: translationProvider === "soniox" ? true : settings.subtitleEnabled
            });
          }}
        >
          {TRANSLATION_PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>既定の翻訳先言語</span>
        <select
          value={settings.defaultTargetLanguage}
          disabled={disabled}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              defaultTargetLanguage: event.currentTarget.value as UserSettings["defaultTargetLanguage"]
            })
          }
        >
          {TARGET_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.labelJa} / {language.labelEn}
            </option>
          ))}
        </select>
      </label>

      <label className="field range-field">
        <span>元の音声音量: {Math.round(settings.originalVolume * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.originalVolume}
          disabled={disabled}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              originalVolume: Number(event.currentTarget.value)
            })
          }
        />
      </label>

      <label className="field range-field">
        <span>翻訳音声音量: {Math.round(settings.translationVolume * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.translationVolume}
          disabled={disabled}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              translationVolume: Number(event.currentTarget.value)
            })
          }
        />
      </label>

      <div className="checkbox-grid">
        <label>
          <input
            type="checkbox"
            checked={isSonioxProvider ? true : settings.subtitleEnabled}
            disabled={disabled || isSonioxProvider}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                subtitleEnabled: event.currentTarget.checked
              })
            }
          />
          翻訳字幕を表示
        </label>
        {isSonioxProvider ? (
          <p className="muted">Soniox は字幕翻訳のみのため、字幕表示は常に有効です。</p>
        ) : null}
        <label>
          <input
            type="checkbox"
            checked={settings.showSourceTranscript}
            disabled={disabled}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                showSourceTranscript: event.currentTarget.checked
              })
            }
          />
          元の文字起こしも表示
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.muteOriginalOnStart}
            disabled={disabled}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                muteOriginalOnStart: event.currentTarget.checked
              })
            }
          />
          開始時に元の音声をミュート
        </label>
      </div>
    </section>
  );
}

import { TARGET_LANGUAGES, type TargetLanguage } from "../../lib/constants/languages";

type LanguageSelectProps = {
  value: TargetLanguage;
  disabled?: boolean;
  onChange: (language: TargetLanguage) => void;
};

export function LanguageSelect({ value, disabled = false, onChange }: LanguageSelectProps) {
  return (
    <label className="field">
      <span>翻訳先言語</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as TargetLanguage)}
      >
        {TARGET_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.labelJa} / {language.labelEn}
          </option>
        ))}
      </select>
    </label>
  );
}

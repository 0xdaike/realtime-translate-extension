type VolumeControlsProps = {
  originalVolume: number;
  translationVolume: number;
  muteOriginalOnStart: boolean;
  disabled?: boolean;
  onChange: (values: {
    originalVolume: number;
    translationVolume: number;
    muteOriginalOnStart: boolean;
  }) => void;
};

export function VolumeControls({
  originalVolume,
  translationVolume,
  muteOriginalOnStart,
  disabled = false,
  onChange
}: VolumeControlsProps) {
  return (
    <section className="control-card">
      <label className="field">
        <span>元の音声: {Math.round(originalVolume * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={originalVolume}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              originalVolume: Number(event.currentTarget.value),
              translationVolume,
              muteOriginalOnStart
            })
          }
        />
      </label>

      <label className="field">
        <span>翻訳音声: {Math.round(translationVolume * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={translationVolume}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              originalVolume,
              translationVolume: Number(event.currentTarget.value),
              muteOriginalOnStart
            })
          }
        />
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={muteOriginalOnStart}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              originalVolume,
              translationVolume,
              muteOriginalOnStart: event.currentTarget.checked
            })
          }
        />
        開始時に元の音声をミュート
      </label>
    </section>
  );
}

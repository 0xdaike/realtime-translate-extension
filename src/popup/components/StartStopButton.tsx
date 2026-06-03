import type { SessionStatus } from "../../types/messages";

type StartStopButtonProps = {
  status: SessionStatus;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function StartStopButton({
  status,
  disabled = false,
  onStart,
  onStop
}: StartStopButtonProps) {
  const isActive =
    status === "preparing" ||
    status === "capturing" ||
    status === "connecting" ||
    status === "connected";
  const isStopping = status === "stopping";
  const isButtonDisabled = isActive ? isStopping : disabled || isStopping;

  return (
    <button
      type="button"
      className={isActive ? "stop-button" : "start-button"}
      disabled={isButtonDisabled}
      onClick={isActive ? onStop : onStart}
    >
      {isActive ? "停止" : "翻訳開始"}
    </button>
  );
}

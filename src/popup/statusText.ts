import type { ErrorCode } from "../lib/errors/errors";
import { getUserFacingErrorMessage } from "../lib/errors/userFacingMessages";
import type { SessionStatus } from "../types/messages";

export const STATUS_LABELS: Record<SessionStatus, string> = {
  idle: "待機中",
  preparing: "準備中",
  capturing: "音声取得中",
  connecting: "接続中",
  connected: "翻訳中",
  stopping: "停止中",
  stopped: "停止しました",
  error: "エラー"
};

export function getStatusDetail(
  status: SessionStatus,
  errorCode?: ErrorCode,
  errorMessage?: string
): string {
  if (status === "error") {
    return errorMessage ?? getUserFacingErrorMessage(errorCode ?? "UNKNOWN_ERROR");
  }

  return "開始すると、現在のタブ音声をリアルタイム翻訳します。";
}

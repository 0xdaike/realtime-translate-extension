import { redactSecret } from "../../security/redaction";
import type { ErrorCode } from "./errors";

export const USER_FACING_ERROR_MESSAGES: Record<ErrorCode, string> = {
  API_KEY_MISSING: "OpenAI APIキーが設定されていません。OptionsでAPIキーを設定してください。",
  API_KEY_LOCKED: "APIキーがロックされています。Optionsでロックを解除してください。",
  API_KEY_DECRYPT_FAILED: "APIキーの復号に失敗しました。パスフレーズを確認してください。",
  CLIENT_SECRET_FAILED: "OpenAI接続用の一時キーを作成できませんでした。",
  TAB_CAPTURE_FAILED: "現在のタブ音声を取得できませんでした。",
  NO_AUDIO_TRACK: "取得したタブに音声トラックがありません。",
  OFFSCREEN_CREATE_FAILED: "音声処理用のバックグラウンド画面を作成できませんでした。",
  WEBRTC_FAILED: "リアルタイム翻訳のWebRTC接続に失敗しました。",
  SDP_OFFER_FAILED: "リアルタイム翻訳の接続準備に失敗しました。",
  REMOTE_AUDIO_FAILED: "翻訳音声の受信に失敗しました。",
  DATA_CHANNEL_FAILED: "字幕イベントの受信に失敗しました。",
  CONTENT_SCRIPT_FAILED: "字幕オーバーレイの準備に失敗しました。",
  AUTOPLAY_BLOCKED: "ブラウザにより翻訳音声の自動再生がブロックされました。",
  PERMISSION_FAILED: "必要なChrome拡張権限を利用できませんでした。",
  UNSUPPORTED_BROWSER: "このブラウザまたはChromeバージョンでは対応していません。",
  SESSION_ALREADY_RUNNING: "すでに翻訳セッションが実行中です。",
  UNKNOWN_ERROR: "不明なエラーが発生しました。"
};

export function getUserFacingErrorMessage(code: ErrorCode, detail?: string): string {
  const baseMessage = USER_FACING_ERROR_MESSAGES[code];

  if (detail === undefined || detail.trim() === "") {
    return baseMessage;
  }

  return `${baseMessage} 詳細: ${redactSecret(detail)}`;
}

import { describe, expect, it } from "vitest";
import { getStatusDetail, STATUS_LABELS } from "../src/popup/statusText";

describe("popup status text", () => {
  it("uses already user-facing error messages without wrapping them again", () => {
    expect(getStatusDetail("error", "CLIENT_SECRET_FAILED", "OpenAI接続用の一時キーを作成できませんでした。")).toBe(
      "OpenAI接続用の一時キーを作成できませんでした。"
    );
  });

  it("falls back to an error-code message when no detail is available", () => {
    expect(getStatusDetail("error", "API_KEY_MISSING")).toContain("OpenAI APIキー");
  });

  it("provides Japanese status labels", () => {
    expect(STATUS_LABELS.connected).toBe("翻訳中");
  });
});

import { describe, expect, it } from "vitest";
import {
  estimateRealtimeTranslateCostUsd,
  formatUsd
} from "../src/lib/usage/costEstimator";

describe("cost estimator", () => {
  it("estimates 60 seconds as 0.034 USD", () => {
    expect(estimateRealtimeTranslateCostUsd(60)).toBe(0.034);
  });

  it("estimates Soniox realtime subtitles with the lower streaming rate", () => {
    expect(estimateRealtimeTranslateCostUsd(60, "soniox")).toBe(0.002);
  });

  it("returns zero for invalid or non-positive seconds", () => {
    expect(estimateRealtimeTranslateCostUsd(0)).toBe(0);
    expect(estimateRealtimeTranslateCostUsd(-1)).toBe(0);
    expect(estimateRealtimeTranslateCostUsd(Number.NaN)).toBe(0);
  });

  it("formats USD values consistently", () => {
    expect(formatUsd(0.034)).toBe("$0.034");
  });
});

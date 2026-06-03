import { redactSecret } from "../security/redaction";
import type { ExtensionMessage } from "../types/messages";

export type ParsedRealtimeTranslationEvent =
  | {
      type: "transcript";
      message: Extract<ExtensionMessage, { type: "TRANSCRIPT_DELTA" }>;
    }
  | {
      type: "error";
      errorMessage: string;
    }
  | {
      type: "ignored";
    };

export function parseRealtimeTranslationEvent(data: unknown): ParsedRealtimeTranslationEvent {
  const event = parseJsonRecord(data);

  if (event === undefined || typeof event.type !== "string") {
    return { type: "ignored" };
  }

  if (event.type === "session.output_transcript.delta") {
    return transcriptEvent("translation", event);
  }

  if (event.type === "session.input_transcript.delta") {
    return transcriptEvent("source", event);
  }

  if (event.type === "error") {
    return {
      type: "error",
      errorMessage: extractErrorMessage(event)
    };
  }

  return { type: "ignored" };
}

function transcriptEvent(
  transcriptType: "source" | "translation",
  event: Record<string, unknown>
): ParsedRealtimeTranslationEvent {
  if (typeof event.delta !== "string" || event.delta === "") {
    return { type: "ignored" };
  }

  return {
    type: "transcript",
    message: {
      type: "TRANSCRIPT_DELTA",
      transcriptType,
      delta: event.delta,
      final: false,
      timestampMs: Date.now()
    }
  };
}

function extractErrorMessage(event: Record<string, unknown>): string {
  const error = event.error;

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? redactSecret(message) : "Realtime translation error.";
  }

  if (typeof error === "string") {
    return redactSecret(error);
  }

  return "Realtime translation error.";
}

function parseJsonRecord(data: unknown): Record<string, unknown> | undefined {
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return isRecord(data) ? data : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

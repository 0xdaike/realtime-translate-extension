import { ExtensionError, isErrorCode, type ErrorCode } from "../errors/errors";
import {
  getStorageValue,
  removeStorageValue,
  setStorageValue,
  type TrustedStorageArea
} from "../../security/storageArea";
import type { SessionStatus } from "../../types/messages";

export type SessionSnapshot = {
  status: SessionStatus;
  activeTabId?: number;
  startedAtMs?: number;
  errorCode?: ErrorCode;
  errorMessage?: string;
};

const ACTIVE_STATUSES = new Set<SessionStatus>([
  "preparing",
  "capturing",
  "connecting",
  "connected",
  "stopping"
]);
const SESSION_STATE_STORAGE_KEY = "active_session_snapshot";

export class SessionStateStore {
  private snapshot: SessionSnapshot = {
    status: "idle"
  };

  constructor(private readonly storageArea?: TrustedStorageArea) {}

  async hydrate(): Promise<SessionSnapshot> {
    if (this.storageArea === undefined) {
      return this.getSnapshot();
    }

    const storedSnapshot = await getStorageValue<unknown>(
      this.storageArea,
      SESSION_STATE_STORAGE_KEY
    );

    if (isSessionSnapshot(storedSnapshot) && ACTIVE_STATUSES.has(storedSnapshot.status)) {
      this.snapshot = storedSnapshot;
    }

    return this.getSnapshot();
  }

  getSnapshot(): SessionSnapshot {
    return { ...this.snapshot };
  }

  startPreparing(activeTabId?: number): SessionSnapshot {
    if (ACTIVE_STATUSES.has(this.snapshot.status)) {
      throw new ExtensionError("SESSION_ALREADY_RUNNING");
    }

    this.snapshot = {
      status: "preparing",
      activeTabId
    };

    this.persistActiveSnapshot();
    return this.getSnapshot();
  }

  setStatus(status: SessionStatus, updates: Partial<SessionSnapshot> = {}): SessionSnapshot {
    this.snapshot = {
      ...this.snapshot,
      ...updates,
      status
    };

    this.persistActiveSnapshot();
    return this.getSnapshot();
  }

  setConnected(nowMs = Date.now()): SessionSnapshot {
    this.snapshot = {
      ...this.snapshot,
      status: "connected",
      startedAtMs: nowMs,
      errorCode: undefined,
      errorMessage: undefined
    };

    this.persistActiveSnapshot();
    return this.getSnapshot();
  }

  setError(errorCode: ErrorCode, errorMessage?: string): SessionSnapshot {
    this.snapshot = {
      ...this.snapshot,
      status: "error",
      errorCode,
      errorMessage
    };

    this.persistActiveSnapshot();
    return this.getSnapshot();
  }

  reset(status: "idle" | "stopped" = "idle"): SessionSnapshot {
    this.snapshot = {
      status
    };

    this.persistActiveSnapshot();
    return this.getSnapshot();
  }

  private persistActiveSnapshot(): void {
    if (this.storageArea === undefined) {
      return;
    }

    if (ACTIVE_STATUSES.has(this.snapshot.status)) {
      void setStorageValue(this.storageArea, SESSION_STATE_STORAGE_KEY, this.snapshot).catch(
        () => undefined
      );
      return;
    }

    void removeStorageValue(this.storageArea, SESSION_STATE_STORAGE_KEY).catch(() => undefined);
  }
}

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  if (!isRecord(value) || !isSessionStatus(value.status)) {
    return false;
  }

  return (
    (value.activeTabId === undefined ||
      (typeof value.activeTabId === "number" && Number.isInteger(value.activeTabId))) &&
    (value.startedAtMs === undefined ||
      (typeof value.startedAtMs === "number" && Number.isFinite(value.startedAtMs))) &&
    (value.errorCode === undefined || isErrorCode(value.errorCode)) &&
    (value.errorMessage === undefined || typeof value.errorMessage === "string")
  );
}

function isSessionStatus(value: unknown): value is SessionStatus {
  return (
    value === "idle" ||
    value === "preparing" ||
    value === "capturing" ||
    value === "connecting" ||
    value === "connected" ||
    value === "stopping" ||
    value === "stopped" ||
    value === "error"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

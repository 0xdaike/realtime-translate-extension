import type { ErrorCode } from "../../lib/errors/errors";
import type { SessionStatus } from "../../types/messages";
import { getStatusDetail, STATUS_LABELS } from "../statusText";

type StatusPanelProps = {
  status: SessionStatus;
  errorCode?: ErrorCode;
  errorMessage?: string;
};

export function StatusPanel({ status, errorCode, errorMessage }: StatusPanelProps) {
  const detail = getStatusDetail(status, errorCode, errorMessage);

  return (
    <section className="status-card" aria-label="session status">
      <span className={`status-dot status-dot-${status}`} aria-hidden="true" />
      <div>
        <strong>{STATUS_LABELS[status]}</strong>
        <p>{detail}</p>
      </div>
    </section>
  );
}

export const OVERLAY_STYLES = `
:host {
  all: initial;
}

.pri-overlay {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 2147483647;
  width: min(760px, calc(100vw - 32px));
  pointer-events: none;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.pri-card {
  display: grid;
  gap: 8px;
  padding: 14px 18px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(20, 83, 45, 0.88)),
    rgba(15, 23, 42, 0.92);
  color: #f8fafc;
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(14px);
}

.pri-status {
  color: #bbf7d0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pri-source {
  color: rgba(226, 232, 240, 0.78);
  font-size: 14px;
  line-height: 1.45;
}

.pri-translation {
  color: #ffffff;
  font-size: clamp(18px, 2.4vw, 26px);
  font-weight: 750;
  line-height: 1.35;
  text-wrap: balance;
}

.pri-empty {
  color: rgba(226, 232, 240, 0.72);
  font-size: 14px;
}
`;

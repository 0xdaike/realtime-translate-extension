export const SERVICE_MODES = [
  {
    id: "byok",
    label: "BYOK",
    description: "自分のOpenAI/Soniox APIキーを使う"
  },
  {
    id: "managed",
    label: "Managed",
    description: "有料プランの自社APIセッションを使う"
  }
] as const;

export type ServiceMode = (typeof SERVICE_MODES)[number]["id"];

export const DEFAULT_SERVICE_MODE: ServiceMode = "byok";

const SERVICE_MODE_IDS = new Set<string>(SERVICE_MODES.map((mode) => mode.id));

export function isServiceMode(value: unknown): value is ServiceMode {
  return typeof value === "string" && SERVICE_MODE_IDS.has(value);
}

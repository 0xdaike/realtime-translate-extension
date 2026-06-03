import type { UserSettings } from "../../types/settings";

export function addLocalUsageSeconds(
  settings: UserSettings,
  seconds: number,
  now: Date = new Date()
): UserSettings {
  const safeSeconds = Math.max(0, Math.floor(seconds));

  if (safeSeconds === 0) {
    return settings;
  }

  const dayKey = getLocalDateKey(now);
  const monthKey = getLocalMonthKey(now);

  return {
    ...settings,
    localUsage: {
      totalSeconds: settings.localUsage.totalSeconds + safeSeconds,
      byDay: {
        ...settings.localUsage.byDay,
        [dayKey]: (settings.localUsage.byDay[dayKey] ?? 0) + safeSeconds
      },
      byMonth: {
        ...settings.localUsage.byMonth,
        [monthKey]: (settings.localUsage.byMonth[monthKey] ?? 0) + safeSeconds
      }
    }
  };
}

export function getLocalDateKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalMonthKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

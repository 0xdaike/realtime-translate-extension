export const MANAGED_SESSION_URL =
  import.meta.env.VITE_MANAGED_SESSION_URL ?? "";

export const MANAGED_REALTIME_ORIGIN =
  import.meta.env.VITE_MANAGED_REALTIME_ORIGIN ?? "";

export function parseManagedHttpsEndpoint(value: string): URL | undefined {
  if (value === "") {
    return undefined;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  return url.protocol === "https:" ? url : undefined;
}

export function getManagedHostPermissionPattern(value = MANAGED_SESSION_URL): string | undefined {
  const endpoint = parseManagedHttpsEndpoint(value);

  return endpoint === undefined ? undefined : `${endpoint.origin}/*`;
}

export function hasManagedHostPermission(
  hostPermissions: readonly string[] | undefined,
  value = MANAGED_SESSION_URL
): boolean {
  const pattern = getManagedHostPermissionPattern(value);

  return pattern !== undefined && hostPermissions?.includes(pattern) === true;
}

export function getAllowedManagedRealtimeOrigin(
  sessionUrl = MANAGED_SESSION_URL,
  configuredRealtimeOrigin = MANAGED_REALTIME_ORIGIN
): string | undefined {
  const configuredOrigin = parseManagedRealtimeOrigin(configuredRealtimeOrigin);

  if (configuredOrigin !== undefined) {
    return configuredOrigin;
  }

  const endpoint = parseManagedHttpsEndpoint(sessionUrl);

  return endpoint === undefined ? undefined : `wss://${endpoint.host}`;
}

function parseManagedRealtimeOrigin(value: string): string | undefined {
  if (value === "") {
    return undefined;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  return url.protocol === "wss:" && url.pathname === "/" && url.search === "" && url.hash === ""
    ? url.origin
    : undefined;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeServiceBaseUrl(rawUrl: string, label = "Service URL"): string {
  const value = rawUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`);
  }

  const isLoopback = LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase());
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
    throw new Error(`${label} must use HTTPS. HTTP is allowed only for local development.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain embedded credentials.`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${label} must not contain a query string or fragment.`);
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

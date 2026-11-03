export function normalizeSupabaseUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid Supabase project URL.");
  }

  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "Use the Supabase project URL without credentials, query parameters, or a fragment.",
    );
  }

  const path = parsed.pathname.replace(/\/+$/, "");
  const normalizedApiPath = path === "/rest/v1" || path === "/auth/v1";

  if (path && !normalizedApiPath) {
    throw new Error(
      "VITE_SUPABASE_URL must be the project’s base URL, not a dashboard or API endpoint URL.",
    );
  }

  return { url: parsed.origin, normalizedApiPath };
}

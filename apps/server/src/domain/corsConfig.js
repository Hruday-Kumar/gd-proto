// M6 (audit 2026-07-28): pure allowlist parsing/checking for CORS, kept
// separate from the `cors` middleware wiring (index.js) so it's testable
// without an HTTP request.
export function parseAllowedOrigins(envValue) {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// No Origin header means the caller isn't a browser enforcing CORS (curl,
// server-to-server, this project's own supertest suite) -- CORS is a
// browser-side protection, so there's nothing to restrict for a caller
// it was never going to apply to.
export function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

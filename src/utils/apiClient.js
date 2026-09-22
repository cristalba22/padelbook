const API_BASE = import.meta.env.VITE_API_URL || "/api";
let csrfToken = "";

export function setCsrfToken(value = "") {
  csrfToken = String(value || "");
}

export async function apiRequest(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(unsafe && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, method, headers, credentials: "include" });
  if (response.status === 204) return {};
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("La API no devolvió una respuesta JSON válida.");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      setCsrfToken();
      window.dispatchEvent(new CustomEvent("padel:auth-expired", { detail: payload }));
    }
    const error = new Error(payload.message || "No se pudo completar la operación.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (payload.csrfToken) setCsrfToken(payload.csrfToken);
  return payload;
}

export async function checkApiHealth(timeoutMs = 5000) {
  try {
    const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", credentials: "include" });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return false;
    const health = await response.json();
    return health.ok === true && health.database === "connected";
  } catch {
    return false;
  }
}

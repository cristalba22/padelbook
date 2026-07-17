const API_BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "padel_auth_token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("La API no devolvio una respuesta JSON valida.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent("padel:auth-expired", { detail: payload }));
    }
    const error = new Error(payload.message || "No se pudo completar la operacion.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1200) });
    const contentType = response.headers.get("content-type") || "";
    return response.ok && contentType.includes("application/json");
  } catch {
    return false;
  }
}

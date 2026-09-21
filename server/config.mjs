import "dotenv/config";

export const PORT = Number(process.env.PORT || 4000);
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
export const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || "8h";
export const SESSION_COOKIE_NAME = "padelbook_session";
export const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === "production" ? "strict" : "lax");
export const API_PROXY_SECRET = process.env.API_PROXY_SECRET || "";
export const MONGODB_URI = process.env.MONGODB_URI || "";
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "padelbook";
export const PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN || CLIENT_ORIGIN;
export const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
export const RESEND_API_URL = process.env.RESEND_API_URL || "https://api.resend.com/emails";
export const PASSWORD_RESET_FROM = process.env.PASSWORD_RESET_FROM || "";
export const PASSWORD_RESET_REPLY_TO = process.env.PASSWORD_RESET_REPLY_TO || "";

function secureOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value && !url.username && !url.password;
  } catch {
    return false;
  }
}

if (!/^[a-zA-Z0-9_-]{3,64}$/.test(MONGODB_DB_NAME)) {
  throw new Error("MONGODB_DB_NAME debe tener entre 3 y 64 caracteres: letras, números, guion o guion bajo.");
}

if (!["lax", "strict", "none"].includes(COOKIE_SAME_SITE)) {
  throw new Error("COOKIE_SAME_SITE debe ser lax, strict o none.");
}

if (!/^(?:[1-9]|1[0-2])h$/.test(TOKEN_EXPIRES_IN)) {
  throw new Error("TOKEN_EXPIRES_IN debe estar entre 1h y 12h.");
}

if (process.env.NODE_ENV === "production") {
  if (process.env.PADELBOOK_DEMO_SEED === "true") {
    throw new Error("PADELBOOK_DEMO_SEED no puede estar activo en producción.");
  }
  if (!secureOrigin(CLIENT_ORIGIN)) {
    throw new Error("CLIENT_ORIGIN debe ser un origen HTTPS exacto, sin ruta ni credenciales.");
  }
  if (!secureOrigin(PUBLIC_APP_ORIGIN)) {
    throw new Error("PUBLIC_APP_ORIGIN debe ser un origen HTTPS exacto, sin ruta ni credenciales.");
  }
  const emailValues = [RESEND_API_KEY, PASSWORD_RESET_FROM];
  if (emailValues.some(Boolean) && !emailValues.every(Boolean)) {
    throw new Error("RESEND_API_KEY y PASSWORD_RESET_FROM deben configurarse juntos.");
  }
  if (COOKIE_SAME_SITE !== "strict") {
    throw new Error("COOKIE_SAME_SITE debe ser strict en producción.");
  }
  if (!MONGODB_URI.startsWith("mongodb+srv://")) {
    throw new Error("MONGODB_URI debe usar una conexión MongoDB Atlas mongodb+srv con TLS en producción.");
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 48 || process.env.JWT_SECRET.includes("change-this-secret")) {
    throw new Error("JWT_SECRET debe tener al menos 48 caracteres aleatorios en producción.");
  }
  if (API_PROXY_SECRET.length < 48) {
    throw new Error("API_PROXY_SECRET debe tener al menos 48 caracteres aleatorios en producción.");
  }
}

if (!process.env.JWT_SECRET) {
  throw new Error("Falta JWT_SECRET en .env. Configura una clave larga y privada antes de iniciar la API.");
}

export const JWT_SECRET = process.env.JWT_SECRET;

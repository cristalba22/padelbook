import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { COOKIE_SAME_SITE, JWT_SECRET, SESSION_COOKIE_NAME, TOKEN_EXPIRES_IN } from "./config.mjs";
import { User } from "./db.mjs";
import { setRequestActor } from "./requestContext.mjs";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function publicUser(user) {
  if (!user) return null;
  const safe = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  delete safe.passwordHash;
  delete safe.sessionVersion;
  return safe;
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || "");
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(value.join("=")); } catch { return ""; }
    }
  }
  return "";
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function createSession(user) {
  const csrfToken = randomBytes(32).toString("base64url");
  const token = jwt.sign({ sub: String(user.id || user._id), sv: Number(user.sessionVersion || 0), csrf: csrfToken }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: TOKEN_EXPIRES_IN,
    issuer: "padelbook-api",
    audience: "padelbook-web",
  });
  return { token, csrfToken };
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = Number.parseInt(TOKEN_EXPIRES_IN, 10) * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=${COOKIE_SAME_SITE}${secure}; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=${COOKIE_SAME_SITE}${secure}; Max-Age=0`;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const cookieToken = readCookie(req, SESSION_COOKIE_NAME);
  const token = cookieToken || (process.env.NODE_ENV !== "production" ? bearer : "");
  if (!token) return res.status(401).json({ message: "Necesitas iniciar sesión." });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"], issuer: "padelbook-api", audience: "padelbook-web" });
    const user = await User.findById(payload.sub).select("+sessionVersion");
    if (!user || user.active === false || Number(payload.sv || 0) !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ message: "Sesión inválida o revocada." });
    }
    if (cookieToken && UNSAFE_METHODS.has(req.method) && !safeEqual(req.get("X-CSRF-Token"), payload.csrf)) {
      return res.status(403).json({ message: "La verificación de seguridad de la sesión falló. Actualizá la página e intentá nuevamente." });
    }
    req.user = publicUser(user);
    req.csrfToken = payload.csrf;
    setRequestActor(req.user);
    next();
  } catch {
    return res.status(401).json({ message: "Sesión expirada o inválida." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Necesitas iniciar sesión." });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "No tenés permisos para esta acción." });
    next();
  };
}

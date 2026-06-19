import jwt from "jsonwebtoken";
import { JWT_SECRET, TOKEN_EXPIRES_IN } from "./config.mjs";
import { User } from "./db.mjs";

export function publicUser(user) {
  if (!user) return null;
  const safe = typeof user.toJSON === "function" ? user.toJSON() : { ...user };
  delete safe.passwordHash;
  return safe;
}

export function signToken(user) {
  return jwt.sign({ sub: String(user.id || user._id), role: user.role, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Necesitas iniciar sesion." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Sesion invalida." });
    req.user = publicUser(user);
    next();
  } catch {
    return res.status(401).json({ message: "Sesion expirada o invalida." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Necesitas iniciar sesion." });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "No tenes permisos para esta accion." });
    next();
  };
}

import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomUUID } from "node:crypto";
import { JWT_SECRET } from "./config.mjs";

export const requestContext = new AsyncLocalStorage();

export function requestContextMiddleware(req, res, next) {
  const requestId = randomUUID();
  const ipHash = createHmac("sha256", JWT_SECRET).update(String(req.ip || "unknown")).digest("hex").slice(0, 24);
  res.setHeader("X-Request-ID", requestId);
  requestContext.run({ requestId, ipHash, actorId: "", actorRole: "" }, next);
}

export function setRequestActor(user) {
  const context = requestContext.getStore();
  if (!context || !user) return;
  context.actorId = String(user.id || "");
  context.actorRole = String(user.role || "");
}

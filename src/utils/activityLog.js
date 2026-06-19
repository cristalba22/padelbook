import { safeRead, safeWrite } from "./storage.js";

const ACTIVITY_KEY = "padel_activity_log";

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readActivity(limit = 30) {
  return safeRead(ACTIVITY_KEY, [])
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, limit);
}

export function addActivity(activity) {
  const item = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    type: activity.type || "info",
    title: activity.title || "Movimiento registrado",
    detail: activity.detail || "",
    actor: activity.actor || "Sistema",
    ...activity,
  };
  const next = [item, ...readActivity(80)].slice(0, 80);
  safeWrite(ACTIVITY_KEY, next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("padel:activity-updated"));
  return item;
}

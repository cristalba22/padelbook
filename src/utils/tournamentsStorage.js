import { tournaments as defaultTournaments } from "../data/adminMock.js";
import { safeRead, safeWrite } from "./storage.js";
import { addActivity } from "./activityLog.js";

export const TOURNAMENTS_KEY = "padel_tournaments";
export const TOURNAMENTS_EVENT = "padel:tournaments-updated";

function makeId(prefix = "item") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStatus(status = "abierto") {
  const value = String(status || "abierto").toLowerCase();
  if (["abierto", "lleno", "en_curso", "finalizado", "cancelado"].includes(value)) return value;
  return "abierto";
}

function rollActiveDemoDate(date, status, id) {
  if (!date || ["finalizado", "cancelado"].includes(normalizeStatus(status))) return date || "";
  const parsed = new Date(`${date}T23:59:59`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(parsed.getTime()) || parsed >= today) return date;

  const offset = 7 + (Number(id || 0) % 5) * 7;
  const next = new Date(today);
  next.setDate(today.getDate() + offset);
  return next.toISOString().slice(0, 10);
}

function normalizeRegistration(reg = {}) {
  return {
    id: reg.id || makeId("reg"),
    userId: reg.userId || reg.email || reg.phone || makeId("guest"),
    name: reg.name || reg.playerName || "Jugador",
    email: String(reg.email || "").toLowerCase(),
    phone: reg.phone || "",
    category: reg.category || "Sin categoría",
    partnerName: reg.partnerName || "",
    partnerPhone: reg.partnerPhone || "",
    paymentStatus: reg.paymentStatus || "pendiente",
    status: reg.status || "pendiente",
    createdAt: reg.createdAt || new Date().toISOString(),
    updatedAt: reg.updatedAt || null,
  };
}

export function activeRegistrations(tournament = {}) {
  return (tournament.registrations || []).filter((r) => !["cancelado", "rechazado"].includes(String(r.status || "").toLowerCase()));
}

export function confirmedRegistrations(tournament = {}) {
  return (tournament.registrations || []).filter((r) => String(r.status || "").toLowerCase() === "confirmado");
}

function normalizeTournament(t = {}, defaultPrice = 25000) {
  const registrations = Array.isArray(t.registrations) ? t.registrations.map(normalizeRegistration) : [];
  const seededPlayers = Number(t.seededPlayers ?? t.basePlayers ?? t.currentPlayers ?? t.players ?? 0);
  const maxPlayers = Number(t.maxPlayers ?? t.capacity ?? 16);
  const active = registrations.filter((r) => !["cancelado", "rechazado"].includes(String(r.status || "").toLowerCase())).length;
  const currentPlayers = Math.min(maxPlayers, seededPlayers + active);
  const normalized = {
    id: t.id || makeId("tournament"),
    name: t.name || "Torneo del club",
    status: normalizeStatus(t.status),
    date: rollActiveDemoDate(t.date, t.status, t.id),
    hour: t.hour || "19:00",
    category: t.category || "Mixto · libre",
    surface: t.surface || "Mixta",
    pricePerPlayer: Number(t.pricePerPlayer ?? defaultPrice),
    seededPlayers,
    currentPlayers,
    maxPlayers,
    prize: t.prize || "Premio del club",
    description: t.description || "Formato relámpago con cupos limitados.",
    registrations,
    createdAt: t.createdAt || new Date().toISOString(),
    updatedAt: t.updatedAt || null,
  };
  if (normalized.status === "abierto" && normalized.currentPlayers >= normalized.maxPlayers) normalized.status = "lleno";
  return normalized;
}

function dispatchUpdate() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOURNAMENTS_EVENT));
}

export function loadTournaments(defaultPrice = 25000) {
  const saved = safeRead(TOURNAMENTS_KEY, null);
  const base = Array.isArray(saved) && saved.length ? saved : defaultTournaments;
  return base.map((t) => normalizeTournament(t, defaultPrice));
}

export function saveTournaments(tournaments, defaultPrice = 25000) {
  const normalized = (tournaments || []).map((t) => normalizeTournament(t, defaultPrice));
  safeWrite(TOURNAMENTS_KEY, normalized);
  dispatchUpdate();
  return normalized;
}

export function canRegisterToTournament(tournament, user) {
  if (!user) return { ok: false, reason: "Necesitás iniciar sesión para inscribirte." };
  if (!tournament) return { ok: false, reason: "Torneo no disponible." };
  if (tournament.status !== "abierto") return { ok: false, reason: "La inscripción no está abierta." };
  if (Number(tournament.currentPlayers || 0) >= Number(tournament.maxPlayers || 0)) return { ok: false, reason: "El torneo no tiene cupos disponibles." };
  const email = String(user.email || "").toLowerCase();
  const exists = activeRegistrations(tournament).some((r) => String(r.email || "").toLowerCase() === email || String(r.userId) === String(user.id));
  if (exists) return { ok: false, reason: "Ya estás inscripta/o en este torneo." };
  return { ok: true, reason: "" };
}

export function registerToTournament(tournamentId, user, extra = {}, defaultPrice = 25000) {
  const tournaments = loadTournaments(defaultPrice);
  let created = null;
  let error = "";
  const next = tournaments.map((t) => {
    if (String(t.id) !== String(tournamentId)) return t;
    const check = canRegisterToTournament(t, user);
    if (!check.ok) { error = check.reason; return t; }
    created = normalizeRegistration({
      userId: user.id || user.email,
      name: user.name || user.email || "Jugador",
      email: user.email,
      phone: user.phone || "",
      category: user.category || "Sin categoría",
      partnerName: extra.partnerName || "",
      partnerPhone: extra.partnerPhone || "",
      status: "pendiente",
      paymentStatus: Number(t.pricePerPlayer || 0) > 0 ? "pendiente" : "sin_cargo",
    });
    return normalizeTournament({ ...t, registrations: [...(t.registrations || []), created], updatedAt: new Date().toISOString() }, defaultPrice);
  });
  if (!created) return { ok: false, error: error || "No se pudo completar la inscripción." };
  saveTournaments(next, defaultPrice);
  const tournament = next.find((t) => String(t.id) === String(tournamentId));
  addActivity({ type: "tournament_signup", title: "Inscripción a torneo", detail: `${created.name} · ${tournament?.name || "Torneo"}`, actor: created.name });
  return { ok: true, registration: created, tournament };
}

export function updateTournamentRegistration(tournamentId, registrationId, patch = {}, defaultPrice = 25000) {
  const tournaments = loadTournaments(defaultPrice);
  let updated = null;
  const next = tournaments.map((t) => {
    if (String(t.id) !== String(tournamentId)) return t;
    const registrations = (t.registrations || []).map((r) => {
      if (String(r.id) !== String(registrationId)) return r;
      updated = normalizeRegistration({ ...r, ...patch, updatedAt: new Date().toISOString() });
      return updated;
    });
    return normalizeTournament({ ...t, registrations, updatedAt: new Date().toISOString() }, defaultPrice);
  });
  saveTournaments(next, defaultPrice);
  if (updated) addActivity({ type: "tournament_registration_updated", title: "Inscripción actualizada", detail: `${updated.name} · ${patch.status || "actualizada"}`, actor: "Club" });
  return updated;
}

export function getUserTournamentRegistrations(user, defaultPrice = 25000) {
  if (!user) return [];
  const email = String(user.email || "").toLowerCase();
  return loadTournaments(defaultPrice).flatMap((t) => (t.registrations || [])
    .filter((r) => String(r.email || "").toLowerCase() === email || String(r.userId) === String(user.id))
    .map((registration) => ({ ...registration, tournamentId: t.id, tournamentName: t.name, tournamentDate: t.date, tournamentHour: t.hour, category: registration.category || t.category, pricePerPlayer: t.pricePerPlayer, statusTournament: t.status })));
}

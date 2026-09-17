import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { safeRead, safeWrite } from "../utils/storage.js";
import { addActivity } from "../utils/activityLog.js";
import { canonicalCourtId } from "../utils/bookingDomain.js";
import { apiRequest } from "../utils/apiClient.js";
import { useAuth } from "./useAuth.jsx";

const ScheduleCtx = createContext(null);
const BLOCKS_KEY = "padel_schedule_blocks";

function blockId(date, courtId, hour) {
  return `${date}-${courtId}-${hour}`;
}

function normalizeHour(hour = "") {
  const raw = String(hour).trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{1}:\d{2}$/.test(raw)) return `0${raw}`;
  return raw;
}

function minutesFromHour(hour = "") {
  const normalized = normalizeHour(hour);
  const [hh = "0", mm = "0"] = normalized.split(":");
  const total = Number(hh) * 60 + Number(mm);
  return Number.isFinite(total) ? total : 0;
}

function normalizeBlock(block = {}) {
  const date = block.date;
  const courtId = canonicalCourtId(block.courtId ?? block.court ?? "");
  const hour = normalizeHour(block.hour ?? block.time);
  return {
    id: blockId(date, courtId, hour),
    date,
    courtId,
    hour,
    durationMinutes: Number(block.durationMinutes || 60),
    reason: block.reason || "No disponible",
    type: block.type || "block",
    ownerId: block.ownerId || "",
    createdAt: block.createdAt || new Date().toISOString(),
  };
}

function readBlocks() {
  return safeRead(BLOCKS_KEY, []).map(normalizeBlock).filter((b) => b.date && b.courtId && b.hour);
}

export function isActiveStatus(status) {
  return status !== "cancelado" && status !== "cancelada";
}

export function sameSlot(booking, date, courtId, hour) {
  const bookingDate = booking?.date;
  const bookingCourt = canonicalCourtId(booking?.courtId ?? booking?.court ?? "");
  const bookingHour = normalizeHour(booking?.time ?? booking?.hour ?? "");
  const bookingStart = minutesFromHour(bookingHour);
  const bookingEnd = bookingStart + Number(booking?.durationMinutes || 60);
  const slotStart = minutesFromHour(hour);
  return bookingDate === date && bookingCourt === canonicalCourtId(courtId) && slotStart >= bookingStart && slotStart < bookingEnd && isActiveStatus(booking?.status);
}

export function ScheduleProvider({ children }) {
  const { apiOnline } = useAuth();
  const [blocks, setBlocks] = useState(readBlocks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const blocksRef = useRef(blocks);
  const mutationQueue = useRef(Promise.resolve());

  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  useEffect(() => {
    if (!apiOnline) safeWrite(BLOCKS_KEY, blocks.map(normalizeBlock));
  }, [blocks, apiOnline]);

  useEffect(() => {
    if (!apiOnline) return;
    let active = true;
    setLoading(true);
    apiRequest("/blocks").then(({ blocks: remote }) => {
      if (!active) return;
      const normalized = (remote || []).map(normalizeBlock);
      blocksRef.current = normalized;
      setBlocks(normalized);
      setError("");
    }).catch((cause) => { if (active) setError(cause.message || "No se pudieron cargar los bloqueos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiOnline]);

  useEffect(() => {
    const sync = (event) => {
      if (!apiOnline && (!event || event.key === BLOCKS_KEY)) setBlocks(readBlocks());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("padel:schedule-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("padel:schedule-updated", sync);
    };
  }, [apiOnline]);

  const commit = useCallback((updater) => {
    const previous = blocksRef.current;
    const next = typeof updater === "function" ? updater(previous) : updater;
    const normalized = next.map(normalizeBlock).filter((b) => b.date && b.courtId && b.hour);
    blocksRef.current = normalized;
    setBlocks(normalized);
    setError("");
    if (!apiOnline) {
      safeWrite(BLOCKS_KEY, normalized);
      window.dispatchEvent(new Event("padel:schedule-updated"));
      return;
    }
    const oldMap = new Map(previous.map((block) => [block.id, block]));
    const newMap = new Map(normalized.map((block) => [block.id, block]));
    const removed = previous.filter((block) => !newMap.has(block.id));
    const upserted = normalized.filter((block) => {
      const old = oldMap.get(block.id);
      return !old || old.reason !== block.reason || old.durationMinutes !== block.durationMinutes || old.type !== block.type;
    });
    const task = mutationQueue.current.then(async () => {
      if (removed.length) {
        const result = await apiRequest("/blocks/batch", { method: "DELETE", body: JSON.stringify({ keys: removed.map(({ date, courtId, hour }) => ({ date, courtId, hour })) }) });
        if (result.deleted !== removed.length) throw new Error("Algunos bloqueos ya habían cambiado. La agenda se actualizará.");
      }
      if (upserted.length) await apiRequest("/blocks/batch", { method: "POST", body: JSON.stringify({ blocks: upserted }) });
      window.dispatchEvent(new Event("padel:schedule-updated"));
    });
    mutationQueue.current = task.catch(async (cause) => {
      setError(cause.message || "No se pudo guardar el calendario.");
      try {
        const { blocks: remote } = await apiRequest("/blocks");
        const fresh = (remote || []).map(normalizeBlock);
        blocksRef.current = fresh;
        setBlocks(fresh);
      } catch { /* La operación sigue marcada como fallida. */ }
    });
  }, [apiOnline]);

  const addBlock = useCallback((block) => {
    const normalized = normalizeBlock(block);
    commit((prev) => {
      const withoutSame = prev.filter((item) => item.id !== normalized.id);
      return [...withoutSame, normalized];
    });
    addActivity({
      type: "slot_blocked",
      title: "Horario bloqueado",
      detail: `${normalized.date} · cancha ${normalized.courtId} · ${normalized.hour} · ${normalized.reason}`,
      actor: block.actor || "Club",
    });
    return normalized;
  }, [commit]);

  const addBlocks = useCallback((incoming) => {
    const normalizedIncoming = incoming.map(normalizeBlock);
    commit((prev) => {
      const map = new Map(prev.map((item) => [item.id, normalizeBlock(item)]));
      normalizedIncoming.forEach((item) => map.set(item.id, item));
      return [...map.values()];
    });
    if (normalizedIncoming.length) {
      const first = normalizedIncoming[0];
      addActivity({
        type: "range_blocked",
        title: "Rango bloqueado",
        detail: `${first.date} · cancha ${first.courtId} · ${normalizedIncoming.length} horarios · ${first.reason}`,
        actor: incoming[0]?.actor || "Club",
      });
    }
  }, [commit]);

  const removeBlock = useCallback((date, courtId, hour) => {
    const id = blockId(date, canonicalCourtId(courtId), normalizeHour(hour));
    commit((prev) => prev.filter((item) => item.id !== id));
  }, [commit]);

  const toggleBlock = useCallback((block) => {
    const normalized = normalizeBlock(block);
    commit((prev) => {
      const exists = prev.some((item) => item.id === normalized.id);
      if (exists) return prev.filter((item) => item.id !== normalized.id);
      return [...prev, normalized];
    });
  }, [commit]);

  const clearDate = useCallback((date) => {
    commit((prev) => prev.filter((item) => item.date !== date));
    addActivity({ type: "blocks_cleared", title: "Bloqueos liberados", detail: `Se liberaron los bloqueos del ${date}`, actor: "Club" });
  }, [commit]);

  const removeBlocksWhere = useCallback((predicate) => {
    if (typeof predicate !== "function") return;
    commit((prev) => prev.filter((item) => !predicate(item)));
  }, [commit]);

  const isBlocked = useCallback((date, courtId, hour) => {
    const normalizedHour = normalizeHour(hour);
    return blocks.some((item) => item.date === date && canonicalCourtId(item.courtId) === canonicalCourtId(courtId) && normalizeHour(item.hour) === normalizedHour);
  }, [blocks]);

  const getBlock = useCallback((date, courtId, hour) => {
    const normalizedHour = normalizeHour(hour);
    return blocks.find((item) => item.date === date && canonicalCourtId(item.courtId) === canonicalCourtId(courtId) && normalizeHour(item.hour) === normalizedHour) || null;
  }, [blocks]);

  const value = useMemo(() => ({ blocks, loading, error, addBlock, addBlocks, removeBlock, removeBlocksWhere, toggleBlock, clearDate, isBlocked, getBlock }), [blocks, loading, error, addBlock, addBlocks, removeBlock, removeBlocksWhere, toggleBlock, clearDate, isBlocked, getBlock]);

  return <ScheduleCtx.Provider value={value}>{children}</ScheduleCtx.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleCtx);
  if (!ctx) throw new Error("useSchedule debe usarse dentro de <ScheduleProvider>");
  return ctx;
}

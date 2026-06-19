import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { safeRead, safeWrite } from "../utils/storage.js";
import { addActivity } from "../utils/activityLog.js";

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

function normalizeBlock(block = {}) {
  const date = block.date;
  const courtId = String(block.courtId ?? block.court ?? "");
  const hour = normalizeHour(block.hour ?? block.time);
  return {
    id: block.id || blockId(date, courtId, hour),
    date,
    courtId,
    hour,
    reason: block.reason || "No disponible",
    type: block.type || "block",
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
  const bookingCourt = String(booking?.courtId ?? booking?.court ?? "");
  const bookingHour = normalizeHour(booking?.time ?? booking?.hour ?? "");
  return bookingDate === date && bookingCourt === String(courtId) && bookingHour === normalizeHour(hour) && isActiveStatus(booking?.status);
}

export function ScheduleProvider({ children }) {
  const [blocks, setBlocks] = useState(readBlocks);

  useEffect(() => {
    safeWrite(BLOCKS_KEY, blocks.map(normalizeBlock));
  }, [blocks]);

  useEffect(() => {
    const sync = (event) => {
      if (!event || event.key === BLOCKS_KEY) setBlocks(readBlocks());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("padel:schedule-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("padel:schedule-updated", sync);
    };
  }, []);

  const commit = useCallback((updater) => {
    setBlocks((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const normalized = next.map(normalizeBlock).filter((b) => b.date && b.courtId && b.hour);
      safeWrite(BLOCKS_KEY, normalized);
      window.dispatchEvent(new Event("padel:schedule-updated"));
      return normalized;
    });
  }, []);

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
    const id = blockId(date, String(courtId), normalizeHour(hour));
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
    return blocks.some((item) => item.date === date && String(item.courtId) === String(courtId) && normalizeHour(item.hour) === normalizedHour);
  }, [blocks]);

  const getBlock = useCallback((date, courtId, hour) => {
    const normalizedHour = normalizeHour(hour);
    return blocks.find((item) => item.date === date && String(item.courtId) === String(courtId) && normalizeHour(item.hour) === normalizedHour) || null;
  }, [blocks]);

  const value = useMemo(() => ({ blocks, addBlock, addBlocks, removeBlock, removeBlocksWhere, toggleBlock, clearDate, isBlocked, getBlock }), [blocks, addBlock, addBlocks, removeBlock, removeBlocksWhere, toggleBlock, clearDate, isBlocked, getBlock]);

  return <ScheduleCtx.Provider value={value}>{children}</ScheduleCtx.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleCtx);
  if (!ctx) throw new Error("useSchedule debe usarse dentro de <ScheduleProvider>");
  return ctx;
}

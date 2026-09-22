import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { COURTS, DURATION_OPTIONS, buildCourtHours } from "../data/bookingConfig.js";
import { apiRequest } from "../utils/apiClient.js";

const CourtConfigContext = createContext(null);

const fallbackCourts = COURTS.map((court, index) => ({
  ...court,
  active: true,
  sortOrder: index,
  openingTime: "09:00",
  closingTime: "22:00",
  slotIntervalMinutes: 30,
  allowedDurations: DURATION_OPTIONS.map((item) => item.minutes),
  basePrice: 18000,
  nightPrice: 24000,
  weekendExtra: 3000,
  hours: buildCourtHours(),
}));

function normalizeCourt(court) {
  const openingTime = court.openingTime || "09:00";
  const closingTime = court.closingTime || "22:00";
  const slotIntervalMinutes = Number(court.slotIntervalMinutes || 30);
  return {
    ...court,
    id: String(court.id),
    active: court.active !== false,
    sortOrder: Number(court.sortOrder || 0),
    openingTime,
    closingTime,
    slotIntervalMinutes,
    allowedDurations: (court.allowedDurations || DURATION_OPTIONS.map((item) => item.minutes)).map(Number).sort((a, b) => a - b),
    basePrice: Number(court.basePrice || 0),
    nightPrice: Number(court.nightPrice || 0),
    weekendExtra: Number(court.weekendExtra || 0),
    hours: court.hours?.length ? court.hours : buildCourtHours(openingTime, closingTime, slotIntervalMinutes),
  };
}

export function CourtConfigProvider({ children }) {
  const [courts, setCourts] = useState(fallbackCourts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async ({ admin = false } = {}) => {
    try {
      const result = await apiRequest(admin ? "/admin/courts" : "/courts");
      const next = (result.courts || []).map(normalizeCourt).sort((a, b) => a.sortOrder - b.sortOrder);
      if (next.length || admin) setCourts(next);
      setError("");
      return next;
    } catch (cause) {
      setError(cause.message || "No se pudieron cargar las canchas.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ courts: courts.filter((court) => court.active), allCourts: courts, loading, error, refresh }), [courts, loading, error, refresh]);
  return <CourtConfigContext.Provider value={value}>{children}</CourtConfigContext.Provider>;
}

export function useCourtConfig() {
  const value = useContext(CourtConfigContext);
  if (!value) throw new Error("useCourtConfig debe usarse dentro de <CourtConfigProvider>");
  return value;
}

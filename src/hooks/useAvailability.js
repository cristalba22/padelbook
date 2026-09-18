import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.jsx";
import { apiRequest } from "../utils/apiClient.js";

export function useAvailability(date) {
  const { apiOnline } = useAuth();
  const [state, setState] = useState({ date: "", occupied: [], teacherBusy: [], loading: false, error: "" });

  useEffect(() => {
    if (!apiOnline || !date) return;
    let active = true;
    setState({ date, occupied: [], teacherBusy: [], loading: true, error: "" });
    const load = () => apiRequest(`/availability?date=${encodeURIComponent(date)}`)
      .then(({ occupied, teacherBusy }) => { if (active) setState({ date, occupied: occupied || [], teacherBusy: teacherBusy || [], loading: false, error: "" }); })
      .catch(() => { if (active) setState({ date, occupied: [], teacherBusy: [], loading: false, error: "No se pudo consultar la disponibilidad." }); });
    load();
    window.addEventListener("padel:bookings-updated", load);
    window.addEventListener("focus", load);
    const interval = window.setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => { active = false; window.removeEventListener("padel:bookings-updated", load); window.removeEventListener("focus", load); window.clearInterval(interval); };
  }, [apiOnline, date]);

  return { occupied: state.date === date ? state.occupied : [], teacherBusy: state.date === date ? state.teacherBusy : [],
    loading: apiOnline && (state.date !== date || state.loading), error: state.date === date ? state.error : "" };
}

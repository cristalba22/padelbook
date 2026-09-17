import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.jsx";
import { apiRequest } from "../utils/apiClient.js";

export function useAvailability(date) {
  const { apiOnline } = useAuth();
  const [state, setState] = useState({ date: "", occupied: [], loading: false });

  useEffect(() => {
    if (!apiOnline || !date) return;
    let active = true;
    setState({ date, occupied: [], loading: true });
    const load = () => apiRequest(`/availability?date=${encodeURIComponent(date)}`)
      .then(({ occupied }) => { if (active) setState({ date, occupied: occupied || [], loading: false }); })
      .catch(() => { if (active) setState({ date, occupied: [], loading: false }); });
    load();
    window.addEventListener("padel:bookings-updated", load);
    return () => { active = false; window.removeEventListener("padel:bookings-updated", load); };
  }, [apiOnline, date]);

  return { occupied: state.date === date ? state.occupied : [], loading: apiOnline && (state.date !== date || state.loading) };
}

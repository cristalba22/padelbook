import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { getUserTournamentRegistrations, loadTournaments, registerToTournament, saveTournaments, TOURNAMENTS_EVENT, updateTournamentRegistration } from "../utils/tournamentsStorage.js";

const TournamentsContext = createContext(null);

export function TournamentsProvider({ children }) {
  const { user, apiOnline } = useAuth();
  const { prices } = usePricing();
  const price = prices.tournamentPrice;
  const [tournaments, setTournaments] = useState(() => apiOnline ? [] : loadTournaments(price));
  const [myRegistrations, setMyRegistrations] = useState(() => apiOnline ? [] : getUserTournamentRegistrations(user, price));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!apiOnline) {
      setTournaments(loadTournaments(price));
      setMyRegistrations(getUserTournamentRegistrations(user, price));
      setError("");
      return;
    }
    setLoading(true);
    try {
      const path = user?.role === "admin" ? "/admin/tournaments" : "/tournaments";
      const [list, mine] = await Promise.all([
        apiRequest(path),
        user ? apiRequest("/tournaments/mine") : Promise.resolve({ registrations: [] }),
      ]);
      setTournaments(list.tournaments || []);
      setMyRegistrations(mine.registrations || []);
      setError("");
    } catch (cause) {
      setTournaments([]);
      setMyRegistrations([]);
      setError(cause.message || "No se pudieron cargar los torneos.");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, price, user?.id, user?.role]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (apiOnline) return;
    const sync = () => refresh();
    window.addEventListener(TOURNAMENTS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(TOURNAMENTS_EVENT, sync); window.removeEventListener("storage", sync); };
  }, [apiOnline, refresh]);

  async function register(tournamentId, extra) {
    if (apiOnline) {
      const result = await apiRequest(`/tournaments/${tournamentId}/register`, { method: "POST", body: JSON.stringify(extra) });
      await refresh();
      return { ok: true, ...result };
    }
    const result = registerToTournament(tournamentId, user, extra, price);
    if (result.ok) await refresh();
    return result;
  }

  async function create(tournament) {
    if (apiOnline) {
      const { id, currentPlayers, registrations, ...payload } = tournament;
      const result = await apiRequest("/admin/tournaments", { method: "POST", body: JSON.stringify(payload) });
      await refresh();
      return result.tournament;
    }
    const next = saveTournaments([tournament, ...tournaments], price);
    setTournaments(next);
    return next[0];
  }

  async function update(id, patch) {
    if (apiOnline) {
      const result = await apiRequest(`/admin/tournaments/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setTournaments((current) => current.map((item) => item.id === id ? result.tournament : item));
      return result.tournament;
    }
    const next = saveTournaments(tournaments.map((item) => item.id === id ? { ...item, ...patch } : item), price);
    setTournaments(next);
    return next.find((item) => item.id === id);
  }

  async function remove(id) {
    if (apiOnline) {
      await apiRequest(`/admin/tournaments/${id}`, { method: "DELETE" });
      setTournaments((current) => current.filter((item) => item.id !== id));
      return;
    }
    setTournaments(saveTournaments(tournaments.filter((item) => item.id !== id), price));
  }

  async function updateRegistration(tournamentId, registrationId, patch) {
    if (apiOnline) {
      const result = await apiRequest(`/admin/tournaments/${tournamentId}/registrations/${registrationId}`, { method: "PATCH", body: JSON.stringify(patch) });
      setTournaments((current) => current.map((item) => item.id === tournamentId ? result.tournament : item));
      return result.tournament;
    }
    const result = updateTournamentRegistration(tournamentId, registrationId, patch, price);
    setTournaments(loadTournaments(price));
    return result;
  }

  const value = useMemo(() => ({ tournaments, myRegistrations, loading, error, refresh, register, create, update, remove, updateRegistration }),
    [tournaments, myRegistrations, loading, error, refresh]);
  return <TournamentsContext.Provider value={value}>{children}</TournamentsContext.Provider>;
}

export function useTournaments() {
  const context = useContext(TournamentsContext);
  if (!context) throw new Error("useTournaments requiere TournamentsProvider");
  return context;
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_CLUB_SETTINGS, loadClubSettings, saveClubSettings } from "../utils/clubSettings.js";
import { apiRequest } from "../utils/apiClient.js";

const ClubSettingsContext = createContext(null);

export function ClubSettingsProvider({ children }) {
  const configuredApi = Boolean(import.meta.env.VITE_API_URL);
  const [settings, setSettings] = useState(() => configuredApi ? { ...DEFAULT_CLUB_SETTINGS } : loadClubSettings());
  const [ready, setReady] = useState(!configuredApi);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/settings")
      .then(({ settings: apiSettings }) => {
        if (cancelled) return;
        if (!apiSettings || !Object.keys(apiSettings).length) throw new Error("Configuración vacía.");
        setSettings(saveClubSettings(apiSettings));
        setReady(true);
        setError(false);
      })
      .catch(() => { if (!cancelled && configuredApi) setError(true); });

    const onStorage = (event) => {
      if (!configuredApi && (!event.key || event.key === "padel_club_settings")) setSettings(loadClubSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [configuredApi, retry]);

  const updateSettings = (patch) => {
    const saved = saveClubSettings({ ...settings, ...patch });
    setSettings(saved);
    return saved;
  };

  const value = useMemo(() => ({ settings, updateSettings }), [settings]);
  return <ClubSettingsContext.Provider value={value}>{ready ? children : <div role={error ? "alert" : "status"} className="grid min-h-screen place-items-center bg-[#080c16] px-6 text-center text-white"><div><p className="text-lg font-semibold">{error ? "No se pudo consultar la información del club." : "Cargando información del club..."}</p>{error && <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-5 rounded-full bg-lime-300 px-5 py-3 font-semibold text-black">Volver a intentar</button>}</div></div>}</ClubSettingsContext.Provider>;
}

export function useClubSettings() {
  const ctx = useContext(ClubSettingsContext);
  if (!ctx) throw new Error("useClubSettings debe usarse dentro de <ClubSettingsProvider>");
  return ctx;
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadClubSettings, saveClubSettings } from "../utils/clubSettings.js";

const ClubSettingsContext = createContext(null);

export function ClubSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => loadClubSettings());

  useEffect(() => {
    const onStorage = (event) => {
      if (!event.key || event.key === "padel_club_settings") setSettings(loadClubSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateSettings = (patch) => {
    const saved = saveClubSettings({ ...settings, ...patch });
    setSettings(saved);
    return saved;
  };

  const value = useMemo(() => ({ settings, updateSettings }), [settings]);
  return <ClubSettingsContext.Provider value={value}>{children}</ClubSettingsContext.Provider>;
}

export function useClubSettings() {
  const ctx = useContext(ClubSettingsContext);
  if (!ctx) throw new Error("useClubSettings debe usarse dentro de <ClubSettingsProvider>");
  return ctx;
}

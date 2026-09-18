// src/context/PricingContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PRICING, loadPricing, savePricing } from "../utils/pricing.js";
import { apiRequest } from "../utils/apiClient.js";

const PricingContext = createContext(null);

export function PricingProvider({ children }) {
  const configuredApi = Boolean(import.meta.env.VITE_API_URL);
  const [prices, setPrices] = useState(() => configuredApi ? { ...DEFAULT_PRICING } : loadPricing());
  const [ready, setReady] = useState(!configuredApi);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configuredApi) setPrices(loadPricing());
    let cancelled = false;
    apiRequest("/settings")
      .then(({ settings }) => {
        if (cancelled) return;
        if (!settings || !Object.keys(settings).length) throw new Error("Configuración vacía.");
        setPrices(savePricing(settings));
        setReady(true);
        setError(false);
      })
      .catch(() => { if (!cancelled && configuredApi) setError(true); });
    return () => {
      cancelled = true;
    };
  }, [configuredApi, retry]);

  const updatePrices = (newPrices) => {
    const saved = savePricing(newPrices);
    setPrices(saved);
    return saved;
  };

  const value = useMemo(() => ({ prices, updatePrices }), [prices]);

  return <PricingContext.Provider value={value}>{ready ? children : <div role={error ? "alert" : "status"} className="grid min-h-screen place-items-center bg-[#080c16] px-6 text-center text-white"><div><p className="text-lg font-semibold">{error ? "No se pudieron consultar los precios del club." : "Cargando precios del club..."}</p>{error && <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-5 rounded-full bg-lime-300 px-5 py-3 font-semibold text-black">Volver a intentar</button>}</div></div>}</PricingContext.Provider>;
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing debe usarse dentro de <PricingProvider>");
  return ctx;
}

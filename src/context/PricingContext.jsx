// src/context/PricingContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadPricing, savePricing } from "../utils/pricing.js";

const PricingContext = createContext(null);

export function PricingProvider({ children }) {
  const [prices, setPrices] = useState(() => loadPricing());

  useEffect(() => {
    setPrices(loadPricing());
  }, []);

  const updatePrices = (newPrices) => {
    const saved = savePricing(newPrices);
    setPrices(saved);
    return saved;
  };

  const value = useMemo(() => ({ prices, updatePrices }), [prices]);

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing debe usarse dentro de <PricingProvider>");
  return ctx;
}

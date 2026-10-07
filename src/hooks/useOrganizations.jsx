import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAuth.jsx";
import { apiRequest } from "../utils/apiClient.js";

const OrganizationsContext = createContext(null);

export function OrganizationsProvider({ children }) {
  const { user, apiOnline } = useAuth();
  const [state, setState] = useState({ organizations: [], loading: Boolean(user && apiOnline), error: "" });
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!user || !apiOnline) {
      setState({ organizations: [], loading: false, error: "" });
      return [];
    }
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const { organizations = [] } = await apiRequest("/auth/organizations");
      if (currentRequest === requestId.current) setState({ organizations, loading: false, error: "" });
      return organizations;
    } catch (error) {
      if (currentRequest === requestId.current) setState({ organizations: [], loading: false, error: error.message || "No pudimos consultar tus clubes." });
      return [];
    }
  }, [user?.id, apiOnline]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { requestId.current += 1; window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <OrganizationsContext.Provider value={value}>{children}</OrganizationsContext.Provider>;
}

export function useOrganizations() {
  const context = useContext(OrganizationsContext);
  if (!context) throw new Error("useOrganizations requiere OrganizationsProvider");
  return context;
}

export function useOptionalOrganizations() {
  return useContext(OrganizationsContext);
}

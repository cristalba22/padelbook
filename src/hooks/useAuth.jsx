import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, checkApiHealth, setCsrfToken } from "../utils/apiClient.js";
import { safeRead, safeRemove, safeWrite } from "../utils/storage.js";

const AuthContext = createContext(null);
const AUTH_KEY = "padel_auth_user";
const USERS_KEY = "padel_registered_users";

const DEFAULT_USERS = [
  { id: "admin-1", name: "Admin Club", email: "admin@club.com", password: "admin123", role: "admin", phone: "+5493510000000", category: "Gestión" },
  { id: "receptionist-1", name: "Recepción Club", email: "recepcion@club.com", password: "recepcion123", role: "receptionist", phone: "+5493510000001", category: "Recepción" },
  { id: "teacher-1", name: "Lucio Profe", email: "lucio@club.com", password: "profe123", role: "teacher", phone: "+5493511111111", category: "Profesor" },
  { id: "player-1", name: "Cristian Alba", email: "crisalba@test.com", password: "player123", role: "player", phone: "+5493512222222", category: "6ta" },
];

function cleanEmail(email = "") {
  return String(email).toLowerCase().trim();
}

function getUsers() {
  const stored = safeRead(USERS_KEY, []);
  const map = new Map([...DEFAULT_USERS, ...stored].map((u) => [cleanEmail(u.email), u]));
  return [...map.values()];
}

function persistUsers(users) {
  const onlyCustom = users.filter((u) => !DEFAULT_USERS.some((d) => cleanEmail(d.email) === cleanEmail(u.email)));
  safeWrite(USERS_KEY, onlyCustom);
}

function publicProfile(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

export function AuthProvider({ children }) {
  const hostedVercelDemo = typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app");
  const demoMode = import.meta.env.VITE_DEMO_MODE === "true" || hostedVercelDemo;
  const configuredApi = Boolean(import.meta.env.VITE_API_URL) || (import.meta.env.PROD && !demoMode);
  const [user, setUser] = useState(() => configuredApi ? null : safeRead(AUTH_KEY, null));
  const [showLogin, setShowLogin] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState(false);

  const initialize = useCallback(async (isActive) => {
    const online = await checkApiHealth();
    if (!isActive()) return;
    if (configuredApi && !online) {
      setApiError(true);
      return;
    }
    if (online) {
      try {
        const { user: profile, csrfToken } = await apiRequest("/auth/me");
        if (!isActive()) return;
        setCsrfToken(csrfToken);
        setUser(profile);
        safeRemove(AUTH_KEY);
      } catch (error) {
        if (!isActive()) return;
        if (error.status !== 401 && configuredApi) {
          setApiError(true);
          return;
        }
        setUser(null);
        safeRemove(AUTH_KEY);
      }
    }
    if (!isActive()) return;
    setApiOnline(online);
    setApiError(false);
    setApiReady(true);
  }, [configuredApi]);

  useEffect(() => {
    let alive = true;
    initialize(() => alive);
    return () => { alive = false; };
  }, [initialize]);

  function retryApi() {
    initialize(() => true);
  }

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      safeRemove(AUTH_KEY);
      setShowLogin(true);
    };
    window.addEventListener("padel:auth-expired", handleExpired);
    return () => window.removeEventListener("padel:auth-expired", handleExpired);
  }, []);

  function openLogin() { setShowLogin(true); }
  function closeLogin() { setShowLogin(false); }

  async function login(email, password = "") {
    if (apiOnline) {
      const { user: profile, csrfToken } = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setCsrfToken(csrfToken);
      setUser(profile);
      safeRemove(AUTH_KEY);
      closeLogin();
      return profile;
    }

    const lower = cleanEmail(email);
    const account = getUsers().find((u) => cleanEmail(u.email) === lower);
    if (!account) throw new Error("No existe una cuenta con ese email. Usa un perfil de prueba o registrate como jugador.");
    if (account.password && account.password !== password) throw new Error("La contraseña ingresada no coincide con la cuenta.");
    const profile = publicProfile(account);
    setUser(profile);
    safeWrite(AUTH_KEY, profile);
    closeLogin();
    return profile;
  }

  async function register({ name, email, password, phone = "", category = "Sin categoría" }) {
    if (apiOnline) {
      const { user: profile, csrfToken } = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, phone, category }),
      });
      setCsrfToken(csrfToken);
      setUser(profile);
      safeRemove(AUTH_KEY);
      closeLogin();
      return profile;
    }

    const lower = cleanEmail(email);
    if (!name?.trim()) throw new Error("Ingresa tu nombre.");
    if (!lower.includes("@")) throw new Error("Ingresa un email valido.");
    if (!password || password.length < 12 || password.length > 72) throw new Error("La contraseña debe tener entre 12 y 72 caracteres.");
    const users = getUsers();
    if (users.some((u) => cleanEmail(u.email) === lower)) throw new Error("Ya existe una cuenta con ese email.");
    const account = { id: `user-${Date.now()}`, name: name.trim(), email: lower, password, role: "player", phone, category };
    persistUsers([...users, account]);
    const profile = publicProfile(account);
    setUser(profile);
    safeWrite(AUTH_KEY, profile);
    closeLogin();
    return profile;
  }

  async function requestPasswordReset(email) {
    if (!apiOnline) throw new Error("La recuperación por correo requiere conexión segura con el club.");
    return apiRequest("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async function updateProfile(updates) {
    if (!user) return null;
    if (apiOnline) {
      const { user: saved } = await apiRequest("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: updates.name, phone: updates.phone, category: updates.category }),
      });
      setUser(saved);
      safeRemove(AUTH_KEY);
      return saved;
    }
    const users = getUsers();
    const nextUser = { ...user, ...updates, email: cleanEmail(updates.email || user.email) };
    const nextUsers = users.map((u) => cleanEmail(u.email) === cleanEmail(user.email) ? { ...u, ...updates, email: nextUser.email } : u);
    persistUsers(nextUsers);
    setUser(nextUser);
    safeWrite(AUTH_KEY, nextUser);
    return nextUser;
  }

  async function changePassword(currentPassword, newPassword) {
    if (!apiOnline) throw new Error("El cambio de contraseña requiere conexión segura con el club.");
    await apiRequest("/auth/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setUser(null);
    setCsrfToken();
    safeRemove(AUTH_KEY);
    setShowLogin(true);
  }

  async function logout() {
    if (apiOnline) await apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setCsrfToken();
    safeRemove(AUTH_KEY);
    closeLogin();
  }

  const value = useMemo(() => ({ user, showLogin, apiOnline, apiReady, openLogin, closeLogin, login, register, requestPasswordReset, updateProfile, changePassword, logout }), [user, showLogin, apiOnline, apiReady]);
  return <AuthContext.Provider value={value}>{apiReady ? children : <div role={apiError ? "alert" : "status"} className="grid min-h-screen place-items-center bg-[#080c16] px-6 text-center text-white"><div className="max-w-md"><h1 className="text-2xl font-bold">{apiError ? "El club no está disponible en este momento" : "Consultando el estado del club..."}</h1>{apiError && <><p className="mt-3 text-sm text-white/65">No podemos consultar la agenda. Para proteger tus reservas, esperá a que se restablezca la conexión.</p><button type="button" onClick={retryApi} className="mt-6 rounded-full bg-lime-300 px-5 py-3 font-semibold text-black">Volver a intentar</button></>}</div></div>}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

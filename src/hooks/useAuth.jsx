import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, checkApiHealth, getAuthToken, setAuthToken } from "../utils/apiClient.js";
import { safeRead, safeRemove, safeWrite } from "../utils/storage.js";

const AuthContext = createContext(null);
const AUTH_KEY = "padel_auth_user";
const USERS_KEY = "padel_registered_users";

const DEFAULT_USERS = [
  { id: "admin-1", name: "Admin Club", email: "admin@club.com", password: "admin123", role: "admin", phone: "+5493510000000", category: "Gestión" },
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
  const [user, setUser] = useState(() => safeRead(AUTH_KEY, null));
  const [showLogin, setShowLogin] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    checkApiHealth().then((online) => {
      if (alive) setApiOnline(online);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    apiRequest("/auth/me")
      .then(({ user: profile }) => {
        setApiOnline(true);
        setUser(profile);
        safeWrite(AUTH_KEY, profile);
      })
      .catch(() => setAuthToken(null));
  }, []);

  function openLogin() { setShowLogin(true); }
  function closeLogin() { setShowLogin(false); }

  async function login(email, password = "") {
    if (apiOnline) {
      const { user: profile, token } = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(token);
      setUser(profile);
      safeWrite(AUTH_KEY, profile);
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
      const { user: profile, token } = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, phone, category }),
      });
      setAuthToken(token);
      setUser(profile);
      safeWrite(AUTH_KEY, profile);
      closeLogin();
      return profile;
    }

    const lower = cleanEmail(email);
    if (!name?.trim()) throw new Error("Ingresa tu nombre.");
    if (!lower.includes("@")) throw new Error("Ingresa un email valido.");
    if (!password || password.length < 4) throw new Error("La contraseña debe tener al menos 4 caracteres.");
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

  function updateProfile(updates) {
    if (!user) return null;
    const users = getUsers();
    const nextUser = { ...user, ...updates, email: cleanEmail(updates.email || user.email) };
    const nextUsers = users.map((u) => cleanEmail(u.email) === cleanEmail(user.email) ? { ...u, ...updates, email: nextUser.email } : u);
    persistUsers(nextUsers);
    setUser(nextUser);
    safeWrite(AUTH_KEY, nextUser);
    return nextUser;
  }

  function logout() {
    setUser(null);
    setAuthToken(null);
    safeRemove(AUTH_KEY);
    closeLogin();
  }

  const value = useMemo(() => ({ user, showLogin, apiOnline, openLogin, closeLogin, login, register, updateProfile, logout }), [user, showLogin, apiOnline]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

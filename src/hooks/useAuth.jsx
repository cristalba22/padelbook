// src/hooks/useAuth.jsx
import React, { createContext, useContext, useState } from "react";

const AuthCtx = createContext(null);

// usuario inicial opcionalmente null
const initialUser = null;
// si quisieras arrancar como admin por defecto:
// const initialUser = { name: "Admin Club", email: "admin@club.com", role: "admin" };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(initialUser);

  function login({ name, email, password }) {
    // mock súper simple
    // si es el admin:
    if (email === "admin@club.com" && password === "admin123") {
      setUser({
        name: name || "Admin Club",
        email,
        role: "admin",
        phone: "54 11 5555-0000",
        category: "admin",
      });
      return;
    }

    // jugador normal
    setUser({
      name: name || email.split("@")[0],
      email,
      role: "player",
      phone: "",
      category: "6ta",
    });
  }

  function register({ name, email, password, phone, category }) {
    // por ahora el register es igual que loguear, pero
    // queda separado para que después lo mandemos al backend
    setUser({
      name: name || email.split("@")[0],
      email,
      role: "player",
      phone: phone || "",
      category: category || "6ta",
    });
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

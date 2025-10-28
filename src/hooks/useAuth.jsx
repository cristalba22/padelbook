import React, { createContext, useContext, useState } from "react";

/*
  Este hook simula autenticación local SIN backend.
  Guarda el usuario en memoria de la app.
  Más adelante cuando hagamos backend + JWT, este archivo va a cambiar.
*/

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Login fake: email + password
  // - Si el email incluye "admin", role = admin
  // - Si no, role = player
  function login({ email, password }) {
    if (!email) return;

    const role = email.toLowerCase().includes("admin")
      ? "admin"
      : "player";

    // Para que funcione el saludo en el navbar,
    // si ya había una cuenta creada con name, la mantenemos.
    setUser((prev) => {
      // si ya había usuario creado con ese email, conservar name
      if (prev && prev.email === email && prev.name) {
        return {
          ...prev,
          email,
          role,
        };
      }

      // si no había, creamos uno genérico
      return {
        name: "Jugador",
        email,
        phone: "+54 11 5555-0000",
        role,
      };
    });
  }

  // Registro fake: creamos cuenta con nombre, teléfono, etc
  function register({ name, email, phone, password }) {
    if (!email || !name) return;
    const role = email.toLowerCase().includes("admin")
      ? "admin"
      : "player";

    setUser({
      name,
      email,
      phone: phone || "+54 11 5555-0000",
      role,
    });
  }

  function logout() {
    setUser(null);
  }

  const value = {
    user,
    login,
    register,
    logout,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

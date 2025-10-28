import React, { createContext, useContext, useState } from "react";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // user = { name, email, role, phone }

  function login(email, password) {
    // MOCK:
    // si email contiene "admin" => admin
    // sino => user normal
    if (email && password) {
      const isAdmin = email.toLowerCase().includes("admin");
      setUser({
        name: isAdmin ? "Admin Club" : "Laura",
        email,
        phone: "+54 11 5555-0000",
        role: isAdmin ? "admin" : "player",
      });
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

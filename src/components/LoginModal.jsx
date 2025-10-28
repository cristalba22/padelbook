import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";

export default function LoginModal({ onClose }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@club.com"); // usar "admin" para ver panel admin
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const ok = login(email, password);
    if (ok) {
      onClose();
    } else {
      alert("Login falló (mock)");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-sm p-5 relative shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-neutral-500 text-xs hover:text-white"
        >
          ✕
        </button>

        <h2 className="text-white font-semibold text-lg mb-1">
          Ingresar
        </h2>
        <p className="text-[11px] text-neutral-500 mb-4">
          Accedé para confirmar tu turno
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-400 mb-1">
              Email
            </label>
            <input
              className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-neutral-400 mb-1">
              Contraseña
            </label>
            <input
              className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-lime-400 text-neutral-900 text-sm font-semibold px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(163,230,53,0.6)] hover:scale-[1.02] active:scale-[0.98] transition"
          >
            Entrar
          </button>

          <p className="text-[10px] text-center text-neutral-600">
            Tip: usá un mail con "admin" para ver el panel admin.
          </p>
        </form>
      </div>
    </div>
  );
}

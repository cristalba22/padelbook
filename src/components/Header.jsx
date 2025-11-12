// src/components/Header.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const links = [
    { to: "/", label: "Inicio" },
    { to: "/booking", label: "Reservar" },
    { to: "/torneos", label: "Torneos" },
    { to: "/comunidad", label: "Comunidad" },
    { to: "/dashboard", label: "Mis turnos" },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-black/70 backdrop-blur border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* logo */}
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-9 h-9 bg-lime-400 rounded-md flex items-center justify-center text-black text-sm font-bold shadow-[0_0_15px_rgba(190,254,41,0.7)]">
            BK
          </div>
          <div className="leading-none">
            <p className="text-xs text-neutral-400">Book Padel</p>
            <p className="text-[10px] text-neutral-600">Gestión de turnos</p>
          </div>
        </div>

        {/* nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-1 rounded-full transition ${
                pathname === link.to
                  ? "text-lime-300 bg-lime-300/5"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* derecha */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs text-neutral-400">
                Hola, {user.name || user.email}
              </span>
              {user.role === "admin" && (
                <button
                  onClick={() => navigate("/admin")}
                  className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1 rounded-lg border border-white/5"
                >
                  Admin
                </button>
              )}
              <button
                onClick={logout}
                className="text-xs text-neutral-300 hover:text-white"
              >
                salir
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/account")}
              className="text-xs text-neutral-200 hover:text-white"
            >
              Ingresar
            </button>
          )}

          <button
            onClick={() => navigate("/booking")}
            className="relative btn-glow text-xs"
          >
            <span className="header-dot w-2 h-2 bg-black/40 rounded-full absolute -left-2 top-1/2 -translate-y-1/2" />
            EMPEZAR
          </button>
        </div>
      </div>
    </header>
  );
}

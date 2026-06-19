// src/components/Layout.jsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import LoginModal from "./LoginModal.jsx";
import { ROUTES, routeForRole } from "../constants/routes.js";

const navItems = [
  { to: ROUTES.BOOKING, label: "Reservar" },
  { to: ROUTES.TOURNAMENTS, label: "Torneos" },
  { to: ROUTES.COMMUNITY, label: "Comunidad" },
  { to: ROUTES.MY_BOOKINGS, label: "Mis turnos" },
];

export default function Layout({ children }) {
  const { user, logout, showLogin, openLogin: openGlobalLogin, closeLogin } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate(ROUTES.HOME);
  };

  const closeMobile = () => setMobileOpen(false);

  const openLogin = () => {
    setMobileOpen(false);
    openGlobalLogin();
  };

  const renderNavLinks = (extraClasses = "") => (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={closeMobile}
          className={({ isActive }) =>
            [
              "text-sm font-medium transition-colors",
              "hover:text-lime-300",
              isActive ? "text-lime-300" : "text-slate-100",
              extraClasses,
            ].join(" ")
          }
        >
          {item.label}
        </NavLink>
      ))}

      {user?.role === "admin" && (
        <NavLink
          to={ROUTES.ADMIN}
          onClick={closeMobile}
          className={({ isActive }) =>
            [
              "text-sm font-medium transition-colors",
              "hover:text-lime-300",
              isActive ? "text-lime-300" : "text-slate-100",
              extraClasses,
            ].join(" ")
          }
        >
          Admin
        </NavLink>
      )}
    </>
  );

  return (
    <>
      <div className="app-shell">
        {/* HEADER */}
        <header className="sticky top-0 z-40 border-b border-black/60 bg-black/95 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
            {/* Logo */}
            <button
              type="button"
              onClick={() => {
                navigate(ROUTES.HOME);
                closeMobile();
              }}
              className="flex items-center gap-1 text-sm font-semibold tracking-tight text-white"
            >
              <span className="text-lime-400">PADEL</span>
              <span>BOOK</span>
            </button>

            {/* Navegación escritorio */}
            <nav className="hidden items-center gap-6 md:flex">
              {renderNavLinks()}
            </nav>

            {/* Usuario / Ingresar / Salir (escritorio) */}
            <div className="hidden items-center gap-2 md:flex">
              {user ? (
                <>
                  <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-2 py-1 text-xs text-slate-100">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-400 text-[11px] font-bold text-black">
                      {user.name?.charAt(0)?.toUpperCase() || "A"}
                    </span>
                    <span>{user.name || "Admin"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-slate-600 px-3 py-1 text-xs font-medium text-slate-100 hover:border-lime-400 hover:text-lime-300"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openLogin}
                  className="rounded-full border border-lime-400/80 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-200 hover:bg-lime-400 hover:text-black"
                >
                  Ingresar
                </button>
              )}
            </div>

            {/* Botón hamburguesa (mobile) */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex items-center justify-center rounded-full border border-slate-700 p-2 text-slate-100 hover:border-lime-400 hover:text-lime-300 md:hidden"
              aria-label="Abrir menú"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Menú móvil desplegable */}
          {mobileOpen && (
            <div className="border-t border-slate-900/70 bg-black/95 md:hidden">
              <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-4 pt-3">
                <nav className="flex flex-col gap-2">
                  {renderNavLinks("py-1")}
                </nav>

                <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                  {user ? (
                    <>
                      <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-400 text-[11px] font-bold text-black">
                          {user.name?.charAt(0)?.toUpperCase() || "A"}
                        </span>
                        <span className="text-slate-100">
                          {user.name || "Admin"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-full border border-slate-600 px-3 py-1 font-medium text-slate-100 hover:border-lime-400 hover:text-lime-300"
                      >
                        Salir
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={openLogin}
                      className="ml-auto rounded-full border border-lime-400/80 bg-lime-400/10 px-3 py-1 font-semibold text-lime-200 hover:bg-lime-400 hover:text-black"
                    >
                      Ingresar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>

        {/* CONTENIDO */}
        <main className="main-container">{children}</main>
      </div>

      {/* MODAL LOGIN */}
      <LoginModal
        isOpen={showLogin}
        onClose={closeLogin}
        onLoggedIn={(role) => { closeLogin(); navigate(routeForRole(role)); }}
      />
    </>
  );
}

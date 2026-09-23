// src/components/Layout.jsx
import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const isAdminWorkspace = location.pathname.startsWith("/admin");

  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    if (!await logout()) return;
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

      {["admin", "receptionist"].includes(user?.role) && (
        <NavLink
          to={routeForRole(user.role)}
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
          {user.role === "admin" ? "Admin" : "Recepción"}
        </NavLink>
      )}
      {user?.role === "teacher" && <NavLink to={ROUTES.TEACHER} onClick={closeMobile} className={({ isActive }) => `text-sm font-medium transition-colors hover:text-lime-300 ${isActive ? "text-lime-300" : "text-slate-100"} ${extraClasses}`}>Panel profe</NavLink>}
      {user?.role === "player" && <NavLink to={ROUTES.PLAYER} onClick={closeMobile} className={({ isActive }) => `text-sm font-medium transition-colors hover:text-lime-300 ${isActive ? "text-lime-300" : "text-slate-100"} ${extraClasses}`}>Mi panel</NavLink>}
    </>
  );

  return (
    <>
      <div className="app-shell">
        <a href="#contenido" className="skip-link">Ir al contenido</a>
        {/* HEADER */}
        {!isAdminWorkspace && <header className="site-header sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            {/* Logo */}
            <button
              type="button"
              onClick={() => {
                navigate(ROUTES.HOME);
                closeMobile();
              }}
              className="site-brand flex items-center gap-1 text-base font-black tracking-tight text-white"
            >
              <span className="site-brand__mark" aria-hidden="true">p.</span>
              <span>padelbook</span>
            </button>

            {/* Navegación escritorio */}
            <nav className="hidden items-center gap-5 lg:gap-7 md:flex" aria-label="Navegación principal">
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
                    <NavLink to={ROUTES.ACCOUNT} className="hover:text-lime-300">{user.name || "Mi cuenta"}</NavLink>
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
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
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
                <nav className="flex flex-col gap-2" aria-label="Navegación móvil">
                  {renderNavLinks("py-1")}
                </nav>

                <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                  {user ? (
                    <>
                      <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-400 text-[11px] font-bold text-black">
                          {user.name?.charAt(0)?.toUpperCase() || "A"}
                        </span>
                        <NavLink to={ROUTES.ACCOUNT} onClick={closeMobile} className="text-slate-100 hover:text-lime-300">{user.name || "Mi cuenta"}</NavLink>
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
        </header>}

        {/* CONTENIDO */}
        <div id="contenido" className="relative z-10 flex-1">{children}</div>
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

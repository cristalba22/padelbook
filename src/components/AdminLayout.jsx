// src/components/AdminLayout.jsx
import React from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: "📊" },
  { to: "/admin/bookings", label: "Reservas", icon: "🎾" },
  { to: "/admin/finance", label: "Finanzas", icon: "$" },
  { to: "/admin/calendar", label: "Calendario", icon: "📅" },
  { to: "/admin/teachers", label: "Profes", icon: "👨‍🏫" },
  { to: "/admin/tournaments", label: "Torneos", icon: "🏆" },
  { to: "/admin/config", label: "Configuración", icon: "⚙️" },
];

export default function AdminLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-[calc(100vh-48px)] bg-[#020617] text-white flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-[#020617] border-b md:border-b-0 md:border-r border-slate-900/80 px-4 py-3 md:py-4 flex flex-col">
        {/* Header del panel */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-400 flex items-center justify-center text-xs font-extrabold text-black shadow-[0_0_24px_rgba(190,254,41,0.7)]">
            PB
          </div>
          <div className="leading-tight">
            <p className="text-xs text-slate-400">Admin</p>
            <p className="text-sm font-semibold">Panel</p>
          </div>
        </div>

        {/* Navegación */}
        <div className="mt-3 md:mt-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-2">
            Navegación
          </p>

          <nav className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  [
                    "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition",
                    "border",
                    isActive
                      ? "bg-lime-400/15 border-lime-400/60 text-lime-100 shadow-[0_0_24px_rgba(190,254,41,0.45)]"
                      : "bg-slate-900/60 border-slate-800 text-slate-200 hover:border-lime-400/50 hover:text-lime-100",
                  ].join(" ")
                }
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-4 hidden pt-3 text-[10px] text-slate-500 md:mt-auto md:block md:pt-4">
          <p>Gestión comercial del club.</p>
          <p>Reservas, precios, staff y torneos.</p>
        </div>
      </aside>

      {/* CONTENIDO DERECHA */}
      <main className="flex-1 min-w-0 px-4 py-6 md:px-8 md:py-8">
        {(title || subtitle) && (
          <header className="mb-5 md:mb-6">
            {title && (
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1 text-xs md:text-sm text-slate-400 max-w-3xl">
                {subtitle}
              </p>
            )}
          </header>
        )}

        {children}
      </main>
    </div>
  );
}

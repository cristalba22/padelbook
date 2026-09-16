import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, CircleDollarSign, ClipboardList, GraduationCap, LogOut, Settings2, Trophy } from "lucide-react";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import "./adminWorkspace.css";

const NAV_ITEMS = [
  { to: "/admin", label: "Inicio", Icon: ChartNoAxesCombined },
  { to: "/admin/calendar", label: "Agenda", Icon: CalendarDays },
  { to: "/admin/bookings", label: "Reservas", Icon: ClipboardList },
  { to: "/admin/finance", label: "Cobros", Icon: CircleDollarSign },
  { to: "/admin/teachers", label: "Profes", Icon: GraduationCap },
  { to: "/admin/tournaments", label: "Torneos", Icon: Trophy },
  { to: "/admin/config", label: "Ajustes", Icon: Settings2 },
];

export default function AdminLayout({ title, subtitle, children }) {
  const { settings } = useClubSettings();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const clubName = settings.clubName || "Tu club";
  const initials = clubName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return (
    <div className="club-admin">
      <div className="club-admin__topbar">
        <div className="club-admin__brand"><span className="club-admin__mark">p.</span><span>padelbook</span><span className="club-admin__brand-suffix">CLUB MANAGER</span></div>
        <div className="club-admin__identity"><Link to="/" className="club-admin__site-link">Ver sitio <ArrowUpRight size={15} aria-hidden="true" /></Link><span><strong>{clubName}</strong><small>Panel del club</small></span><span className="club-admin__avatar" aria-hidden="true">{initials}</span><button type="button" className="club-admin__logout" aria-label="Cerrar sesión" onClick={() => { logout(); navigate("/"); }}><LogOut size={17} aria-hidden="true" /></button></div>
      </div>
      <div className="club-admin__shell">
        <nav className="club-admin__rail" aria-label="Administración del club">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/admin"} aria-label={label} className={({ isActive }) => `club-admin__nav-link${isActive ? " is-active" : ""}`}>
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="club-admin__main">
          {(title || subtitle) && <header className="club-admin__page-heading">{title && <h1>{title}</h1>}{subtitle && <p>{subtitle}</p>}</header>}
          {children}
        </main>
      </div>
    </div>
  );
}

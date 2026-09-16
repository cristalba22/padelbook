import React, { useEffect, useRef } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, CircleDollarSign, ClipboardList, GraduationCap, LogOut, Settings2, Trophy } from "lucide-react";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
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
  const { logout, apiOnline } = useAuth();
  const { bookings = [] } = useBooking();
  const navigate = useNavigate();
  const location = useLocation();
  const tabsRef = useRef(null);
  const clubName = settings.clubName || "Tu club";
  const initials = clubName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  const section = NAV_ITEMS.find((item) => item.to === location.pathname)?.label || "Panel";

  useEffect(() => {
    const tabs = tabsRef.current;
    const activeTab = tabs?.querySelector(".club-admin__tab.is-active");
    if (tabs && activeTab) tabs.scrollLeft = activeTab.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - activeTab.clientWidth) / 2;
  }, [location.pathname]);

  return (
    <div className="club-admin">
      <div className="club-admin__topbar">
        <div className="club-admin__brand"><span className="club-admin__mark">p.</span><span>padelbook</span><span className="club-admin__brand-suffix">CLUB MANAGER</span></div>
        <div className="club-admin__identity"><Link to="/" className="club-admin__site-link">Ver sitio <ArrowUpRight size={15} aria-hidden="true" /></Link><span><strong>{clubName}</strong><small>Panel del club</small></span><span className="club-admin__avatar" aria-hidden="true">{initials}</span><button type="button" className="club-admin__logout" aria-label="Cerrar sesión" onClick={() => { logout(); navigate("/"); }}><LogOut size={17} aria-hidden="true" /></button></div>
      </div>
      <div className="club-admin__shell">
        <nav ref={tabsRef} className="club-admin__tabs" aria-label="Secciones del panel">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/admin"} aria-label={label} className={({ isActive }) => `club-admin__tab${isActive ? " is-active" : ""}`}>
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="club-admin__main">
          <div className="club-admin__context"><span>Panel del club <span aria-hidden="true">/</span> <strong>{section}</strong></span>{!apiOnline && <span className="club-admin__mode">{bookings.length ? "Modo local · datos en este navegador" : "Vista demo · reservas de ejemplo"}</span>}</div>
          {(title || subtitle) && <header className="club-admin__page-heading">{title && <h1>{title}</h1>}{subtitle && <p>{subtitle}</p>}</header>}
          {children}
        </main>
      </div>
    </div>
  );
}

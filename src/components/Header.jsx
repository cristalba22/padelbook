// src/components/Header.jsx

import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { ROUTES } from "../constants/routes.js";
import LoginModal from "./LoginModal.jsx";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // ESTADO PARA EL MENÚ HAMBURGUESA

  const handleOpenLogin = () => setShowLogin(true);
  const handleCloseLogin = () => setShowLogin(false);

  // FUNCIÓN PARA ALTERNAR EL MENÚ
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLoggedIn = (role) => {
    // Redirecciones según rol
    if (role === "admin") {
      navigate(ROUTES.ADMIN);
    } else if (role === "teacher") {
      navigate(ROUTES.TEACHER);
    } else {
      navigate(ROUTES.MY_BOOKINGS);
    }
  };

  const handleStartClick = () => {
    setShowLogin(true);
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTES.HOME);
  };

  // Mantener tus clases de NavLink
  const linkClass =
    "px-3 py-1 text-sm text-zinc-300 hover:text-lime-300 transition";
  const activeClass =
    "px-3 py-1 text-sm rounded-full bg-lime-500 text-black font-semibold";

  return (
    <>
      <header className="main-header">
        <div className="header-inner">
          {/* Logo */}
          <div
            className="logo-box" 
            onClick={() => navigate(ROUTES.HOME)}
          >
            <div className="w-8 h-8 rounded-xl bg-lime-500 flex items-center justify-center text-xs font-bold text-black">
              BK
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm text-white font-semibold">
                Book Padel
              </span>
              <span className="text-[11px] text-zinc-400">
                Gestión de turnos
              </span>
            </div>
          </div>
          
          {/* BOTÓN HAMBURGUESA */}
          <button
              className={`menu-toggle ${isOpen ? 'is-active' : ''}`}
              onClick={toggleMenu}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
          >
              <span></span>
              <span></span>
              <span></span>
          </button>

          {/* NAV CONTAINER (header-links) */}
          <nav 
            id="mobile-menu" 
            className={`header-links ${isOpen ? 'is-open' : ''}`}
          >
            {/* ⬅️ NUEVO: Grupo de Enlaces de Navegación */}
            <div className="nav-links-group"> 
                <NavLink
                  to="/"
                  className={({ isActive }) => (isActive ? activeClass : linkClass)}
                  onClick={toggleMenu}
                >
                  Inicio
                </NavLink>
                <NavLink
                  to={ROUTES.BOOKING}
                  className={({ isActive }) => (isActive ? activeClass : linkClass)}
                  onClick={toggleMenu}
                >
                  Reservar
                </NavLink>
                <NavLink
                  to="/torneos"
                  className={({ isActive }) => (isActive ? activeClass : linkClass)}
                  onClick={toggleMenu}
                >
                  Torneos
                </NavLink>
                <NavLink
                  to="/comunidad"
                  className={({ isActive }) => (isActive ? activeClass : linkClass)}
                  onClick={toggleMenu}
                >
                  Comunidad
                </NavLink>
                {user && (
                  <NavLink
                    to="/mis-turnos"
                    className={({ isActive }) =>
                      isActive ? activeClass : linkClass
                    }
                    onClick={toggleMenu}
                  >
                    Mis turnos
                  </NavLink>
                )}
            </div>

            {/* ACCIONES DERECHA (header-actions) */}
            <div className="header-actions">
              {user ? (
                <>
                  <span className="text-xs text-zinc-400">
                    Hola,{" "}
                    <span className="font-semibold text-lime-300">
                      {user.name || user.role?.toUpperCase()}
                    </span>
                  </span>
                  {user.role === "admin" && (
                    <button
                      className="text-xs text-zinc-300 hover:text-lime-300"
                      onClick={() => navigate(ROUTES.ADMIN)}
                    >
                      Admin
                    </button>
                  )}
                  {user.role === "teacher" && (
                    <button
                      className="text-xs text-zinc-300 hover:text-lime-300"
                      onClick={() => navigate(ROUTES.TEACHER)}
                    >
                      Panel profe
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 rounded-full text-xs border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    salir
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleOpenLogin}
                    className="text-sm text-zinc-300 hover:text-lime-300"
                  >
                    Ingresar
                  </button>
                  <button
                    onClick={handleStartClick}
                    className="px-5 py-1.5 rounded-full text-sm font-semibold bg-lime-500 text-black shadow-[0_0_25px_rgba(190,242,100,0.6)] hover:bg-lime-400 transition"
                  >
                    EMPEZAR
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Modal de login */}
      <LoginModal
        isOpen={showLogin}
        onClose={handleCloseLogin}
        onLoggedIn={handleLoggedIn}
      />
    </>
  );
}
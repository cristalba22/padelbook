import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth.jsx";

export default function Header() {
  const { user, logout } = useAuth();
  const [openMenu, setOpenMenu] = useState(false);

  const isAdmin = user && user.role === "admin";

  const NavLinks = () => (
    <>
      <Link
        to="/"
        className="hover:text-lime-400 transition-colors text-sm font-medium"
        onClick={() => setOpenMenu(false)}
      >
        Inicio
      </Link>

      <Link
        to="/booking"
        className="hover:text-lime-400 transition-colors text-sm font-medium"
        onClick={() => setOpenMenu(false)}
      >
        Reservar
      </Link>

      {isAdmin && (
        <Link
          to="/admin"
          className="hover:text-lime-400 transition-colors text-sm font-medium"
          onClick={() => setOpenMenu(false)}
        >
          Admin
        </Link>
      )}

      {user && (
        <Link
          to="/dashboard"
          className="hover:text-lime-400 transition-colors text-sm font-medium"
          onClick={() => setOpenMenu(false)}
        >
          Mis Turnos
        </Link>
      )}

      {!user ? (
        <Link
          to="/account"
          className="hover:text-lime-400 transition-colors text-sm font-medium"
          onClick={() => setOpenMenu(false)}
        >
          Ingresar
        </Link>
      ) : (
        <button
          className="text-left hover:text-red-400 transition-colors text-sm font-medium"
          onClick={() => {
            logout();
            setOpenMenu(false);
          }}
        >
          salir
        </button>
      )}
    </>
  );

  return (
    <>
      <header className="bg-neutral-950 border-b border-neutral-800 text-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-[52px]">
          {/* Marca */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex items-baseline gap-[4px]">
              <div className="bg-lime-400 text-neutral-900 font-bold text-[10px] leading-none rounded-[4px] px-[6px] py-[4px] shadow-[0_0_10px_rgba(163,230,53,0.6)] group-hover:shadow-[0_0_15px_rgba(163,230,53,0.8)] transition">
                BK
              </div>
              <div className="bg-lime-400 text-neutral-900 font-bold text-[10px] leading-none rounded-[4px] px-[6px] py-[4px] shadow-[0_0_10px_rgba(163,230,53,0.6)] group-hover:shadow-[0_0_15px_rgba(163,230,53,0.8)] transition">
                PDL
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-semibold text-[13px] leading-none">
                Book Padel
              </span>
              <span className="text-[10px] text-neutral-500 leading-none">
                Gestión de turnos
              </span>
            </div>
          </Link>

          {/* Navegación desktop */}
          <nav className="hidden md:flex items-center gap-5 text-neutral-300">
            <NavLinks />
            <Link
              to="/booking"
              className="bg-lime-400 text-neutral-900 font-semibold text-[12px] px-3 py-1.5 rounded-md shadow-[0_0_15px_rgba(163,230,53,0.6)] hover:scale-[1.03] active:scale-[0.97] transition"
            >
              EMPEZAR
            </Link>
          </nav>

          {/* Botón menú mobile */}
          <button
            className="md:hidden text-neutral-300 text-sm border border-neutral-700 rounded-md px-2 py-1 hover:border-lime-400 hover:text-lime-400 transition"
            onClick={() => setOpenMenu(true)}
          >
            ☰
          </button>
        </div>
      </header>

      {/* Menú móvil overlay */}
      <AnimatePresence>
        {openMenu && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* panel deslizante */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="w-[75%] max-w-[260px] h-full bg-neutral-900 border-l border-neutral-800 shadow-[0_0_40px_rgba(163,230,53,0.3)] flex flex-col p-5"
            >
              {/* header mini dentro del panel */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex flex-col leading-none">
                  <div className="text-white font-semibold text-[14px] leading-none">
                    {user ? `Hola ${user.name || "Jugador"}` : "Bienvenido"}
                  </div>
                  <div className="text-[10px] text-lime-400 leading-none font-semibold">
                    {user
                      ? isAdmin
                        ? "ADMIN"
                        : "Jugador"
                      : "Invitado"}
                  </div>
                </div>

                <button
                  className="text-neutral-500 text-[13px] hover:text-white transition"
                  onClick={() => setOpenMenu(false)}
                >
                  ✕
                </button>
              </div>

              {/* links */}
              <div className="flex flex-col gap-4 text-neutral-200 text-[14px] font-medium">
                <NavLinks />
              </div>

              <div className="mt-6">
                <Link
                  to="/booking"
                  onClick={() => setOpenMenu(false)}
                  className="block w-full text-center bg-lime-400 text-neutral-900 font-semibold text-[13px] px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(163,230,53,0.6)] hover:scale-[1.03] active:scale-[0.97] transition"
                >
                  Reservar ahora
                </Link>
              </div>

              <div className="text-[10px] text-neutral-600 mt-auto pt-6 border-t border-neutral-800 leading-relaxed">
                Book Padel · Gestión de turnos  
                <br />
                v0.2 (demo local)
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

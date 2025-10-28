import React from "react";
import { Routes, Route, Link } from "react-router-dom";

import { useAuth } from "./hooks/useAuth.jsx";

import Home from "./pages/Home.jsx";
import Booking from "./pages/Booking.jsx";
import Admin from "./pages/Admin.jsx";
import PlayerDashboard from "./pages/PlayerDashboard.jsx";
import Account from "./pages/Account.jsx";

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/95 backdrop-blur border-b border-neutral-800">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-lime-400 text-neutral-900 font-bold text-xs px-2 py-1 rounded">
            BK
          </div>
          <span className="text-white font-semibold text-sm sm:text-base">
            Book Padel
          </span>
          <span className="hidden sm:inline text-neutral-500 text-xs ml-1">
            Gestión de turnos
          </span>
        </Link>

        {/* Links */}
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-neutral-300 hover:text-lime-400">
            Inicio
          </Link>

          <Link
            to="/booking"
            className="text-neutral-300 hover:text-lime-400"
          >
            Reservar
          </Link>

          {user?.role === "admin" && (
            <Link
              to="/admin"
              className="text-neutral-300 hover:text-lime-400"
            >
              Admin
            </Link>
          )}

          {user?.role === "player" && (
            <Link
              to="/dashboard"
              className="text-neutral-300 hover:text-lime-400"
            >
              Mis Turnos
            </Link>
          )}

          {user ? (
            <>
              <Link
                to="/account"
                className="text-neutral-300 hover:text-lime-400 flex items-center gap-1"
              >
                <span className="text-neutral-500 text-xs">Hola,</span>
                <span className="text-white font-semibold text-sm">
                  {user.name || "Jugador"}
                </span>
              </Link>
              <button
                onClick={logout}
                className="text-neutral-500 hover:text-white text-xs ml-1"
              >
                salir
              </button>
            </>
          ) : (
            <Link
              to="/account"
              className="text-neutral-300 hover:text-lime-400 text-sm"
            >
              Ingresar
            </Link>
          )}

          <Link
            to="/booking"
            className="ml-2 bg-lime-400 text-neutral-900 font-semibold px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(163,230,53,0.6)] hover:scale-[1.05] active:scale-[0.97] transition hidden sm:block"
          >
            EMPEZAR
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-neutral-950 border-t border-neutral-900 py-10 mt-20 text-sm">
      <div className="max-w-6xl mx-auto px-4 grid sm:grid-cols-3 gap-6">
        <div>
          <div className="text-white font-semibold text-base">Book Padel</div>
          <p className="text-neutral-400 text-sm mt-2">
            Reservá canchas en tiempo real. Gestión simple para tu club.
          </p>
        </div>

        <div>
          <div className="text-white font-semibold mb-2">Contacto</div>
          <p className="text-neutral-400 text-sm leading-relaxed">
            WhatsApp:{" "}
            <span className="text-lime-400">+543517662142</span>
            <br />
            Instagram:{" "}
            <span className="text-lime-400">@bookpadel</span>
            <br />
            Email:{" "}
            <span className="text-lime-400">contacto@bookpadel.com</span>
          </p>
        </div>

        <div>
          <div className="text-white font-semibold mb-2">Redes</div>
          <div className="flex flex-col text-neutral-400">
            <a href="#" className="hover:text-lime-400">
              Instagram
            </a>
            <a
              href="https://wa.me/543517662122"
              className="hover:text-lime-400"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="text-center text-neutral-600 text-xs mt-8">
        © 2025 Book Padel. Todos los derechos reservados.
      </div>
    </footer>
  );
}

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Navbar />

      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/dashboard" element={<PlayerDashboard />} />
          <Route path="/account" element={<Account />} />
        </Routes>
      </main>

      <Footer />

      {/* Botón flotante WhatsApp */}
      <a
        href="https://wa.me/543517662122?text=Hola!%20Quiero%20consultar%20por%20turnos%20de%20p%C3%A1del"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-lime-400 rounded-full p-3 shadow-[0_0_30px_rgba(163,230,53,0.6)] hover:scale-[1.05] active:scale-[0.97] transition"
      >
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
          alt="WhatsApp"
          className="w-6 h-6"
        />
      </a>
    </div>
  );
}

export default App;

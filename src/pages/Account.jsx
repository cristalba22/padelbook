import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";

export default function Account() {
  const { user, login, register, logout } = useAuth();

  // estado para los formularios
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    login({ email: loginEmail, password: loginPass });
  }

  function handleRegister(e) {
    e.preventDefault();
    register({
      name: regName,
      email: regEmail,
      phone: regPhone,
      password: regPass,
    });
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-10 text-white">
      <h2 className="text-white font-bold text-2xl leading-tight">
        Mi Cuenta
      </h2>

      {!user && (
        <p className="text-neutral-500 text-sm max-w-md mt-1">
          Ingresá si ya tenés cuenta, o creá una nueva en un toque.
        </p>
      )}

      {user && (
        <div className="mt-2 text-neutral-400 text-sm">
          Sesión iniciada como{" "}
          <span className="text-white font-semibold">{user.name}</span>{" "}
          ({user.email}) — Rol:{" "}
          <span className="text-lime-400 font-semibold uppercase">{user.role}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 mt-10">
        {/* LOGIN */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 shadow-[0_0_30px_rgba(0,0,0,0.6)] text-sm">
          <div className="text-white font-semibold text-lg leading-tight">
            Iniciar sesión
          </div>
          <p className="text-neutral-500 text-xs mt-1">
            Si ya tenés cuenta, entrá con tu email.
          </p>

          <form onSubmit={handleLogin} className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <label className="text-neutral-400 text-xs font-medium">
                Email
              </label>
              <input
                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="tu@email.com"
                type="email"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-neutral-400 text-xs font-medium">
                Contraseña
              </label>
              <input
                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="********"
                type="password"
                required
              />
            </div>

            <button
              type="submit"
              className="bg-lime-400 text-neutral-900 text-sm font-semibold px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(163,230,53,0.6)] hover:scale-[1.02] active:scale-[0.98] transition"
            >
              Entrar
            </button>

            <p className="text-[10px] text-neutral-600 leading-relaxed">
              Tip: si usás un email con la palabra "admin", quedás como admin y ves el panel del club.
              Ejemplo: admin@club.com
            </p>
          </form>
        </div>

        {/* REGISTRO */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 shadow-[0_0_30px_rgba(0,0,0,0.6)] text-sm">
          <div className="text-white font-semibold text-lg leading-tight">
            Crear cuenta
          </div>
          <p className="text-neutral-500 text-xs mt-1">
            Registrate para reservar turnos y ver tus horarios.
          </p>

          <form onSubmit={handleRegister} className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <label className="text-neutral-400 text-xs font-medium">
                Nombre
              </label>
              <input
                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Tu nombre"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-neutral-400 text-xs font-medium">
                WhatsApp / Teléfono
              </label>
              <input
                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+54 11 ..."
              />
            </div>

            <div className="grid gap-2">
              <label className="text-neutral-400 text-xs font-medium">
                Email
              </label>
              <input
                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="tu@email.com"
                type="email"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-neutral-400 text-xs font-medium">
                Contraseña
              </label>
              <input
                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
                value={regPass}
                onChange={(e) => setRegPass(e.target.value)}
                placeholder="********"
                type="password"
                required
              />
            </div>

            <button
              type="submit"
              className="bg-lime-400 text-neutral-900 text-sm font-semibold px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(163,230,53,0.6)] hover:scale-[1.02] active:scale-[0.98] transition"
            >
              Crear cuenta
            </button>

            <p className="text-[10px] text-neutral-600 leading-relaxed">
              Cuando confirmes, ya vas a poder ver "Mis Turnos" y pagar seña.
              Si ponés un email con "admin", vas a ver también el panel del club.
            </p>
          </form>
        </div>
      </div>

      {user && (
        <div className="mt-10 bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 text-sm text-neutral-300 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <div className="text-white font-semibold text-lg leading-tight">
            Sesión activa
          </div>

          <div className="text-[13px] text-neutral-300 mt-3 space-y-1">
            <div>
              <span className="text-neutral-500">Nombre: </span>
              <span className="text-white font-medium">{user.name}</span>
            </div>
            <div>
              <span className="text-neutral-500">Email: </span>
              <span className="text-white font-medium">{user.email}</span>
            </div>
            <div>
              <span className="text-neutral-500">Teléfono: </span>
              <span className="text-white font-medium">{user.phone}</span>
            </div>
            <div>
              <span className="text-neutral-500">Rol: </span>
              <span className="text-lime-400 font-semibold uppercase">
                {user.role}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-5 text-neutral-500 hover:text-white underline text-xs"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </section>
  );
}

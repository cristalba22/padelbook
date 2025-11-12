// src/pages/Account.jsx
import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useNavigate } from "react-router-dom";

export default function Account() {
  const { user, login, register, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("login");

  const [loginData, setLoginData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    category: "6ta",
  });

  function handleLoginSubmit(e) {
    e.preventDefault();
    if (!loginData.email || !loginData.password) return;

    login({
      name: loginData.name,
      email: loginData.email,
      password: loginData.password,
    });

    // apenas entra, lo mando a reservar
    navigate("/booking");
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();
    if (!registerData.email || !registerData.password) return;

    register({
      name: registerData.name,
      email: registerData.email,
      password: registerData.password,
      phone: registerData.phone,
      category: registerData.category,
    });

    // recién registrado → va a reservar
    navigate("/booking");
  }

  // si ya está logueado, mostramos el perfil básico
  if (user) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 min-h-[70vh]">
        <h2 className="text-2xl font-semibold mb-6">Mi cuenta</h2>
        <div className="bg-[#101010] border border-[#1d3210] rounded-xl p-6 mb-6">
          <p className="text-sm text-neutral-400 mb-4">
            Estás logueado como:
          </p>
          <p className="text-lg font-medium">{user.name}</p>
          <p className="text-sm text-neutral-300">{user.email}</p>
          <p className="text-sm text-neutral-300 mt-1">
            Rol: <span className="uppercase">{user.role}</span>
          </p>
          {user.category && (
            <p className="text-sm text-neutral-300">
              Categoría: {user.category}
            </p>
          )}

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => navigate("/booking")}
              className="px-4 py-2 bg-lime-500 hover:bg-lime-400 text-black rounded-lg text-sm"
            >
              Ir a reservar
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
        <p className="text-sm text-neutral-500">
          Ahora ya podés reservar, ver tus turnos o entrar al panel (si sos
          admin).
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] max-w-md mx-auto py-12 px-4">
      <div className="bg-[#101010] border border-[#1d3210] rounded-xl overflow-hidden">
        {/* pestañas */}
        <div className="flex">
          <button
            onClick={() => setActiveTab("login")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "login"
                ? "bg-[#1f3e13] text-white"
                : "bg-transparent text-neutral-400"
            }`}
          >
            Ingresar
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "register"
                ? "bg-[#1f3e13] text-white"
                : "bg-transparent text-neutral-400"
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* contenido */}
        {activeTab === "login" ? (
          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-2">Ingresar</h2>
            <p className="text-xs text-neutral-400 mb-4">
              Usá tu mail para entrar. Para modo admin:{" "}
              <span className="text-green-300">admin@club.com / admin123</span>
            </p>
            <input
              type="text"
              placeholder="Tu nombre (opcional jugador)"
              value={loginData.name}
              onChange={(e) =>
                setLoginData((p) => ({ ...p, name: e.target.value }))
              }
              className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400"
            />
            <input
              type="email"
              placeholder="Email"
              value={loginData.email}
              onChange={(e) =>
                setLoginData((p) => ({ ...p, email: e.target.value }))
              }
              className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={loginData.password}
              onChange={(e) =>
                setLoginData((p) => ({ ...p, password: e.target.value }))
              }
              className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400"
            />
            <button
              type="submit"
              className="w-full bg-lime-500 hover:bg-lime-400 text-black font-medium rounded-lg py-2 text-sm transition"
            >
              Entrar
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-2">Crear cuenta</h2>
            <p className="text-xs text-neutral-400 mb-4">
              Registrate para poder reservar y que el club tenga tus datos.
            </p>
            <input
              type="text"
              placeholder="Nombre y apellido"
              value={registerData.name}
              onChange={(e) =>
                setRegisterData((p) => ({ ...p, name: e.target.value }))
              }
              className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400"
            />
            <input
              type="email"
              placeholder="Email"
              value={registerData.email}
              onChange={(e) =>
                setRegisterData((p) => ({ ...p, email: e.target.value }))
              }
              className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={registerData.password}
              onChange={(e) =>
                setRegisterData((p) => ({ ...p, password: e.target.value }))
              }
              className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400"
            />
            <input
              type="text"
              placeholder="Teléfono / WhatsApp"
              value={registerData.phone}
              onChange={(e) =>
                setRegisterData((p) => ({ ...p, phone: e.target.value }))
              }
              className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400"
            />

            <label className="text-xs text-neutral-400 block">
              Categoría (podés cambiarla después):
            </label>
            <select
              value={registerData.category}
              onChange={(e) =>
                setRegisterData((p) => ({ ...p, category: e.target.value }))
              }
              className="w-full bg-black/30 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400"
            >
              <option value="7ma">7ma</option>
              <option value="6ta">6ta</option>
              <option value="5ta">5ta</option>
              <option value="4ta">4ta</option>
              <option value="3ra">3ra</option>
              <option value="2da">2da</option>
            </select>

            <button
              type="submit"
              className="w-full bg-lime-500 hover:bg-lime-400 text-black font-medium rounded-lg py-2 text-sm transition"
            >
              Registrarme
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

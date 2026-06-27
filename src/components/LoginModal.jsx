import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";

const CATEGORIES = ["Sin categoría", "7ma", "6ta", "5ta", "4ta", "3ra", "2da"];

const DEMO_PROFILES = [
  {
    id: "player",
    label: "Jugador",
    email: "crisalba@test.com",
    password: "player123",
    detail: "Reservas, agenda, pagos y torneos.",
    tone: "border-lime-300/30 text-lime-100",
  },
  {
    id: "teacher",
    label: "Profe",
    email: "lucio@club.com",
    password: "profe123",
    detail: "Clases del día y disponibilidad.",
    tone: "border-sky-300/30 text-sky-100",
  },
  {
    id: "admin",
    label: "Admin",
    email: "admin@club.com",
    password: "admin123",
    detail: "Reservas, calendario, staff y métricas.",
    tone: "border-emerald-300/30 text-emerald-100",
  },
];

export default function LoginModal({ isOpen, onClose, onLoggedIn }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("crisalba@test.com");
  const [password, setPassword] = useState("player123");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("6ta");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const close = () => {
    setError("");
    if (typeof onClose === "function") onClose();
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    if (nextMode === "register") {
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setCategory("Sin categoría");
    } else {
      setEmail("crisalba@test.com");
      setPassword("player123");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const profile = mode === "register"
        ? await register({ name, email, password, phone, category })
        : await login(email, password);
      if (typeof onLoggedIn === "function") onLoggedIn(profile.role);
      close();
    } catch (err) {
      setError(err.message || "No pudimos completar el acceso.");
    }
  };

  const fill = (profile) => {
    setMode("login");
    setError("");
    setEmail(profile.email);
    setPassword(profile.password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#080D1B] shadow-[0_25px_90px_rgba(0,0,0,.85)] md:grid-cols-[0.92fr_1.08fr]">
        <button
          type="button"
          className="absolute right-5 top-4 z-10 text-xl font-bold text-slate-500 hover:text-white"
          onClick={close}
          aria-label="Cerrar modal"
        >
          x
        </button>

        <aside className="hidden border-r border-white/10 bg-white/[0.03] p-7 md:block">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-300">PadelBook</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">Acceso al club</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Una entrada clara para mostrar el producto completo: jugador, profe y administración.
          </p>

          <div className="mt-7 space-y-3">
            <SidePoint value="30s" label="para reservar un turno" />
            <SidePoint value="3" label="roles navegables" />
            <SidePoint value="24/7" label="agenda disponible" />
          </div>
        </aside>

        <section className="p-6 sm:p-7">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-300">Acceso al club</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
            {mode === "login" ? "Ingresar" : "Crear cuenta"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {mode === "login"
              ? "Usá un perfil de prueba o ingresá con una cuenta registrada."
              : "Creá un perfil de jugador con datos útiles para reservas, torneos y comunidad."}
          </p>

          <div className="mt-5 grid grid-cols-2 rounded-full border border-white/10 bg-black/30 p-1 text-xs font-bold">
            <button type="button" onClick={() => changeMode("login")} className={`rounded-full py-2.5 ${mode === "login" ? "bg-lime-300 text-black" : "text-slate-300"}`}>Ingresar</button>
            <button type="button" onClick={() => changeMode("register")} className={`rounded-full py-2.5 ${mode === "register" ? "bg-lime-300 text-black" : "text-slate-300"}`}>Registrarme</button>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-100">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {mode === "register" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre">
                  <input value={name} onChange={(event) => setName(event.target.value)} className="field" placeholder="Tu nombre" autoComplete="name" required />
                </Field>
                <Field label="Teléfono">
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} className="field" placeholder="+54 9..." autoComplete="tel" />
                </Field>
                <Field label="Categoría">
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="field">
                    {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Nivel visible">
                  <input className="field opacity-70" value="Jugador del club" disabled />
                </Field>
              </div>
            )}

            <Field label="Email">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field" placeholder="tu@email.com" autoComplete="email" required />
            </Field>
            <Field label="Contraseña">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field" placeholder="********" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
            </Field>

            <button type="submit" className="btn-primary w-full justify-center py-3">
              {mode === "login" ? "Entrar al panel" : "Crear cuenta de jugador"}
            </button>
          </form>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Perfiles de prueba</p>
              <span className="text-[10px] text-slate-400">Click y entrar</span>
            </div>
            <div className="grid gap-2">
              {DEMO_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => fill(profile)}
                  className={`rounded-2xl border bg-black/25 px-3 py-2 text-left transition hover:bg-white/[0.06] ${profile.tone}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black">{profile.label}</span>
                    <span className="text-[10px] text-slate-400">{profile.email}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300">{profile.detail}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs text-slate-300">{label}</span>{children}</label>;
}

function SidePoint({ value, label }) {
  return (
    <div className="rounded-2xl border border-lime-300/15 bg-lime-300/10 px-4 py-3">
      <p className="text-2xl font-black text-lime-100">{value}</p>
      <p className="text-xs text-slate-300">{label}</p>
    </div>
  );
}

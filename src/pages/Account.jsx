import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES, routeForRole } from "../constants/routes.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import { money } from "../utils/businessMetrics.js";
import { usePricing } from "../context/PricingContext.jsx";
import { useTournaments } from "../hooks/useTournaments.jsx";
import { argentinaDateISO } from "../utils/bookingDomain.js";
import PasswordField from "../components/PasswordField.jsx";

const CATEGORIES = ["Sin categoría", "7ma", "6ta", "5ta", "4ta", "3ra", "2da", "Profesor"];

function todayISO() {
  return argentinaDateISO();
}

export default function Account() {
  const { user, login, register, updateProfile } = useAuth();
  const { bookings } = useBooking();
  const { prices } = usePricing();
  const navigate = useNavigate();
  const [mode, setMode] = useState(user ? "profile" : "login");
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", password: "", phone: user?.phone || "", category: user?.category || "Sin categoría" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { myRegistrations } = useTournaments();

  const userBookings = useMemo(() => {
    if (!user?.email) return [];
    return bookings.filter((b) => !b.userEmail || b.userEmail === user.email);
  }, [bookings, user?.email]);
  const activeBookings = userBookings.filter((b) => b.status !== "cancelado");
  const pendingBookings = activeBookings.filter((b) => b.status === "pendiente");
  const confirmedBookings = activeBookings.filter((b) => b.status === "confirmado");
  const nextBooking = [...activeBookings].sort((a, b) => `${a.date}T${a.time || a.hour}`.localeCompare(`${b.date}T${b.time || b.hour}`))[0];
  const totalSpent = activeBookings.reduce((acc, b) => acc + Number(b.price || b.total || 0), 0);
  const tournamentRegistrations = myRegistrations;
  const tournamentGroups = useMemo(() => splitTournamentRegistrations(tournamentRegistrations), [tournamentRegistrations]);
  const activeTournamentRegistrations = tournamentGroups.upcoming;

  function setField(name, value) { setForm((prev) => ({ ...prev, [name]: value })); }

  async function submitAccess(e) {
    e.preventDefault(); setMessage(""); setError("");
    try { const profile = mode === "register" ? await register(form) : await login(form.email, form.password); navigate(routeForRole(profile.role)); }
    catch (err) { setError(err.message || "No se pudo completar la operación."); }
  }

  async function saveProfile(e) {
    e.preventDefault(); setMessage(""); setError("");
    try { await updateProfile({ name: form.name, phone: form.phone, category: form.category }); setMessage("Perfil actualizado correctamente."); }
    catch (err) { setError(err.message || "No se pudo guardar el perfil."); }
  }

  if (user && ["admin", "receptionist"].includes(user.role)) {
    return <main className="main-container interior-page account-page text-white"><section className="interior-hero mx-auto max-w-3xl rounded-[2rem] p-6 md:p-9"><p className="text-xs font-bold uppercase tracking-[0.22em] text-lime-300">Perfil del equipo</p><h1 className="mt-3 text-3xl font-black">{user.name}</h1><p className="mt-2 text-sm text-slate-300">{user.role === "admin" ? "Propietario / administrador" : "Recepción"} · {user.email}</p><p className="mt-3 text-sm text-slate-400">Tu cuenta identifica las acciones que realizás en la agenda y los cobros del club.</p>{message && <p role="status" className="mt-5 rounded-2xl border border-lime-300/25 bg-lime-300/10 p-3 text-sm text-lime-100">{message}</p>}{error && <p role="alert" className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}<form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm">Nombre<input className="field mt-2" value={form.name} onChange={(event) => setField("name", event.target.value)} required minLength={2} /></label><label className="text-sm">Teléfono<input className="field mt-2" value={form.phone} onChange={(event) => setField("phone", event.target.value)} /></label><div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" className="btn-primary">Guardar perfil</button><button type="button" onClick={() => navigate(routeForRole(user.role))} className="btn-outline">Ir al panel</button></div></form></section></main>;
  }

  if (user && mode === "profile") {
    return (
      <main className="main-container interior-page account-page text-white">
        <section className="interior-hero mb-6 rounded-[2.2rem] border border-white/10 bg-[#060B18] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.8)]">
          <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-300">Cuenta del jugador</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em]">Hola, {user.name || "jugador"}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Tu perfil mantiene sincronizadas las reservas, pagos, categoría y contacto que usa el club para gestionar tus turnos.</p>
            </div>
            <div className="rounded-[1.7rem] border border-lime-300/20 bg-lime-300/10 p-4">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold uppercase tracking-[0.2em] text-lime-100">Tus reservas</span><span className="text-lime-100">{activeBookings.length}</span></div>
              <p className="mt-2 text-xs text-slate-300">Consultá tus turnos activos, pagos registrados y próximos torneos desde esta cuenta.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniKpi label="Reservas activas" value={activeBookings.length} />
            <MiniKpi label="Confirmadas" value={confirmedBookings.length} />
            <MiniKpi label="Pendientes" value={pendingBookings.length} />
            <MiniKpi label="Total reservado" value={money(totalSpent)} />
            <MiniKpi label="Torneos" value={activeTournamentRegistrations.length} />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-6 shadow-xl">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Datos de contacto</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Usamos estos datos para que el club pueda confirmar reservas y ubicar tu nivel de juego.</p>
            {message && <div className="mt-5 rounded-2xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-sm font-semibold text-lime-100">{message}</div>}
            {error && <div className="mt-5 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">{error}</div>}
            <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label><span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-slate-500">Nombre</span><input className="field" value={form.name} onChange={(e) => setField("name", e.target.value)} /></label>
              <label><span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-slate-500">Email</span><input className="field opacity-70" value={user.email} disabled /></label>
              <label><span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-slate-500">Teléfono</span><input className="field" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+54 9 ..." /></label>
              <label><span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-slate-500">Categoría</span><select className="field" value={form.category} onChange={(e) => setField("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2"><button className="btn-primary">Guardar cambios</button><button type="button" onClick={() => navigate(ROUTES.MY_BOOKINGS)} className="btn-outline">Ver mis turnos</button></div>
            </form>
          </div>



          <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-6 shadow-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.04em]">Mis torneos</h2>
                <p className="mt-2 text-sm text-slate-400">Inscripciones activas, historial y categoría con la que te anotaste.</p>
              </div>
              <button type="button" onClick={() => navigate(ROUTES.TOURNAMENTS)} className="btn-outline justify-center">Buscar torneo</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniKpi label="Próximos" value={tournamentGroups.upcoming.length} />
              <MiniKpi label="Confirmados" value={tournamentGroups.confirmed.length} />
              <MiniKpi label="Anteriores" value={tournamentGroups.history.length} />
            </div>

            <div className="mt-6">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-lime-100">Próximos torneos</p>
              <div className="space-y-3">
                {tournamentGroups.upcoming.length ? tournamentGroups.upcoming.map((r) => <TournamentAccountRow key={`${r.tournamentId}-${r.id}`} registration={r} />) : <EmptyTournamentMessage text="No tenés torneos próximos. Cuando te inscribas, vas a ver acá la fecha, estado y categoría." />}
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Historial</p>
              <div className="space-y-3">
                {tournamentGroups.history.length ? tournamentGroups.history.slice(0, 5).map((r) => <TournamentAccountRow key={`${r.tournamentId}-${r.id}`} registration={r} muted />) : <EmptyTournamentMessage text="Todavía no hay torneos anteriores en tu cuenta." />}
              </div>
            </div>
          </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Próximo turno</p>
              {nextBooking ? <div className="mt-3 rounded-2xl border border-lime-300/20 bg-lime-300/10 p-4"><p className="text-2xl font-black text-white">{nextBooking.time || nextBooking.hour}</p><p className="text-sm text-lime-100">{nextBooking.date}</p><p className="mt-1 text-sm text-slate-300">{nextBooking.courtName || nextBooking.court}</p></div> : <p className="mt-3 text-sm text-slate-400">Todavía no tenés turnos activos.</p>}
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Accesos</p>
              <div className="mt-3 grid gap-2"><button onClick={() => navigate(ROUTES.BOOKING)} className="btn-primary justify-center">Reservar turno</button><button onClick={() => navigate(ROUTES.COMMUNITY)} className="btn-outline justify-center">Buscar comunidad</button></div>
            </div>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="main-container interior-page account-page mx-auto max-w-md text-white">
      <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-6 shadow-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-300">Acceso al club</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">{mode === "login" ? "Ingresar" : "Crear cuenta"}</h1>
        <p className="mt-2 text-sm text-slate-400">Creá tu usuario para reservar, consultar pagos y gestionar tus turnos desde la web.</p>
        <div className="mt-5 grid grid-cols-2 rounded-full border border-white/10 bg-black/30 p-1 text-xs font-bold"><button type="button" onClick={() => setMode("login")} className={`rounded-full py-2 ${mode === "login" ? "bg-lime-300 text-black" : "text-slate-300"}`}>Ingresar</button><button type="button" onClick={() => setMode("register")} className={`rounded-full py-2 ${mode === "register" ? "bg-lime-300 text-black" : "text-slate-300"}`}>Registrarme</button></div>
        {error && <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-100">{error}</div>}
        <form onSubmit={submitAccess} className="mt-5 space-y-3">
          {mode === "register" && <label className="block"><span className="mb-1 block text-xs text-slate-400">Nombre</span><input name="name" autoComplete="name" className="field" value={form.name} onChange={(e) => setField("name", e.target.value)} required /></label>}
          <label className="block"><span className="mb-1 block text-xs text-slate-400">Email</span><input name="email" autoComplete={mode === "login" ? "username" : "email"} type="email" className="field" value={form.email} onChange={(e) => setField("email", e.target.value)} required /></label>
          <PasswordField id="account-password" value={form.password} onValueChange={(value) => setField("password", value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : undefined} required showGenerator={mode === "register"} />
          <button className="btn-primary w-full justify-center">{mode === "login" ? "Entrar" : "Crear cuenta"}</button>
        </form>
      </div>
    </main>
  );
}

function splitTournamentRegistrations(registrations = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fallbackDate = todayISO();
  const ordered = [...registrations].sort((a, b) => `${a.tournamentDate || fallbackDate}T${a.tournamentHour || "00:00"}`.localeCompare(`${b.tournamentDate || fallbackDate}T${b.tournamentHour || "00:00"}`));
  const isPast = (item) => {
    const tournamentStatus = String(item.statusTournament || "").toLowerCase();
    if (["finalizado", "cancelado"].includes(tournamentStatus)) return true;
    if (String(item.status || "").toLowerCase() === "cancelado") return true;
    if (!item.tournamentDate) return false;
    const date = new Date(`${item.tournamentDate}T23:59:59`);
    return !Number.isNaN(date.getTime()) && date < today;
  };
  const upcoming = ordered.filter((item) => !isPast(item));
  const history = ordered.filter(isPast).reverse();
  const confirmed = ordered.filter((item) => item.status === "confirmado");
  return { upcoming, history, confirmed };
}

function TournamentAccountRow({ registration, muted = false }) {
  const status = String(registration.status || "pendiente").toLowerCase();
  const statusStyle = status === "confirmado"
    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
    : status === "cancelado"
      ? "border-red-300/30 bg-red-300/10 text-red-100"
      : "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return (
    <article className={`rounded-3xl border border-white/10 ${muted ? "bg-black/15" : "bg-black/25"} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-white">{registration.tournamentName}</p>
          <p className="mt-1 text-xs text-slate-400">{registration.tournamentDate || "Fecha a confirmar"} · {registration.tournamentHour || "20:00"}</p>
          <p className="mt-1 text-xs font-bold text-lime-100">Categoría inscripta: {registration.category || "Sin categoría"}</p>
          {registration.partnerName && <p className="mt-1 text-xs text-slate-300">Pareja: {registration.partnerName}</p>}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusStyle}`}>{status}</span>
      </div>
    </article>
  );
}

function EmptyTournamentMessage({ text }) {
  return <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-400">{text}</div>;
}

function MiniKpi({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>; }

// src/pages/Admin.jsx
import React from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";

const mockClasses = [
  {
    id: "cl-1",
    date: "2025-11-07",
    time: "09:00 hs",
    teacher: "Lucio",
    type: "Clase individual",
    price: 12000,
    student: "Bruno Pérez",
    status: "confirmado",
    phone: "+54 11 2222-4444",
  },
  {
    id: "cl-2",
    date: "2025-11-07",
    time: "11:00 hs",
    teacher: "Eze",
    type: "Clase grupal (hasta 4)",
    price: 8000,
    student: "Grupo intermedio",
    status: "pendiente",
    phone: "+54 11 3333-7777",
  },
];

const mockTournamentRegs = [
  {
    id: "tn-1",
    name: "Relámpago nocturno",
    player: "crisalba",
    phone: "+54 351 555-0000",
    pair: "sin pareja",
    status: "pendiente",
  },
  {
    id: "tn-2",
    name: "Mixto finde",
    player: "Laura Lencina",
    phone: "+54 11 5555-1111",
    pair: "con pareja",
    status: "confirmado",
  },
  {
    id: "tn-3",
    name: "7ma / 6ta puntable",
    player: "Mila Dog",
    phone: "+54 11 5555-3333",
    pair: "sin pareja",
    status: "pendiente",
  },
];

const mockCommunityGroups = [
  {
    id: "cg-7ma",
    name: "7ma categoría",
    members: 32,
    whatsapp: "https://wa.me/543511234567",
  },
  {
    id: "cg-6ta",
    name: "6ta categoría",
    members: 28,
    whatsapp: "https://wa.me/543511234567",
  },
  {
    id: "cg-profes",
    name: "Profes / clases",
    members: 5,
    whatsapp: "https://wa.me/543511234567",
  },
];

export default function Admin() {
  const { user } = useAuth();
  // de nuestro contexto de reservas
  const { clubBookings = [] } = useBooking(); // si no existe, queda []

  return (
    <div className="min-h-screen pt-24 pb-16 max-w-6xl mx-auto px-4 text-white">
      {/* cabecera admin */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Panel del club
          </h1>
          <p className="text-sm text-neutral-400 max-w-2xl">
            Todas las reservas, clases, inscripciones a torneos y los grupos de
            jugadores para escribirles rápido.
          </p>
        </div>
        <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl px-4 py-2 text-right">
          <p className="text-xs text-neutral-300">Admin</p>
          <p className="text-sm font-medium leading-tight">
            {user?.name || "Admin Club"}
          </p>
          <p className="text-[10px] text-lime-200 mt-1">
            Rol: ADMIN • acceso completo
          </p>
        </div>
      </div>

      {/* Reservas de canchas */}
      <section className="bg-black/30 border border-white/5 rounded-2xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold">Reservas de canchas</h2>
          <p className="text-[11px] text-neutral-500">
            {clubBookings.length} reservas
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/20 text-xs text-neutral-500">
              <tr>
                <th className="px-5 py-2 text-left">Fecha</th>
                <th className="px-5 py-2 text-left">Hora</th>
                <th className="px-5 py-2 text-left">Cancha / Detalle</th>
                <th className="px-5 py-2 text-left">Jugador</th>
                <th className="px-5 py-2 text-left">Precio</th>
                <th className="px-5 py-2 text-left">Estado</th>
                <th className="px-5 py-2 text-left">Contacto</th>
                <th className="px-5 py-2 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {clubBookings.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-6 text-center text-neutral-500 text-xs"
                  >
                    Todavía no hay reservas hechas por jugadores.
                  </td>
                </tr>
              )}
              {clubBookings.map((b) => (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="px-5 py-2">{b.date}</td>
                  <td className="px-5 py-2">{b.time}</td>
                  <td className="px-5 py-2">{b.courtName}</td>
                  <td className="px-5 py-2">
                    {b.playerName || b.player || "Jugador"}
                  </td>
                  <td className="px-5 py-2 text-lime-300">${b.price}</td>
                  <td className="px-5 py-2">
                    <span
                      className={`text-[10px] px-2 py-1 rounded-full border ${
                        b.status === "confirmado"
                          ? "bg-lime-500/10 border-lime-500/40 text-lime-200"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-100"
                      }`}
                    >
                      {b.status || "pendiente"}
                    </span>
                  </td>
                  <td className="px-5 py-2">
                    <button className="text-xs text-lime-200 underline underline-offset-2">
                      WhatsApp
                    </button>
                  </td>
                  <td className="px-5 py-2 space-x-2">
                    <button className="text-xs text-red-200/90 hover:text-red-100">
                      Cancelar
                    </button>
                    <button className="text-xs text-neutral-200/70 hover:text-white/90">
                      Reprogramar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-neutral-500 px-5 py-3">
          Estos datos salen del contexto (mock). En producción, vienen de la API
          del club.
        </p>
      </section>

      {/* Clases con profesor */}
      <section className="bg-black/30 border border-white/5 rounded-2xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold">Clases con profesor</h2>
          <p className="text-[11px] text-neutral-500">
            {mockClasses.length} clases
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/20 text-xs text-neutral-500">
              <tr>
                <th className="px-5 py-2 text-left">Fecha</th>
                <th className="px-5 py-2 text-left">Hora</th>
                <th className="px-5 py-2 text-left">Clase</th>
                <th className="px-5 py-2 text-left">Alumno / grupo</th>
                <th className="px-5 py-2 text-left">Precio</th>
                <th className="px-5 py-2 text-left">Estado</th>
                <th className="px-5 py-2 text-left">Contacto</th>
              </tr>
            </thead>
            <tbody>
              {mockClasses.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="px-5 py-2">{c.date}</td>
                  <td className="px-5 py-2">{c.time}</td>
                  <td className="px-5 py-2">
                    {c.type} ({c.teacher})
                  </td>
                  <td className="px-5 py-2">{c.student}</td>
                  <td className="px-5 py-2 text-lime-300">${c.price}</td>
                  <td className="px-5 py-2">
                    <span
                      className={`text-[10px] px-2 py-1 rounded-full border ${
                        c.status === "confirmado"
                          ? "bg-lime-500/10 border-lime-500/40 text-lime-200"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-100"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-2">
                    <a
                      href={`https://wa.me/${c.phone?.replace(/\D/g, "") || ""}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-lime-200 underline"
                    >
                      WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* inscriptos torneos + comunidad */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* torneos */}
        <section className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold">Inscriptos a torneos</h2>
            <p className="text-[11px] text-neutral-500">
              {mockTournamentRegs.length} jugadores
            </p>
          </div>
          <ul className="divide-y divide-white/5">
            {mockTournamentRegs.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">{t.player}</p>
                  <p className="text-xs text-neutral-400">
                    {t.name} • {t.pair}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full ${
                      t.status === "confirmado"
                        ? "bg-lime-500/10 text-lime-100"
                        : "bg-amber-500/10 text-amber-100"
                    }`}
                  >
                    {t.status}
                  </span>
                  <a
                    href={`https://wa.me/${t.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-lime-200 underline"
                  >
                    WA
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* comunidad */}
        <section className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold">Grupos de la comunidad</h2>
            <p className="text-[11px] text-neutral-500">
              {mockCommunityGroups.length} grupos
            </p>
          </div>
          <ul className="divide-y divide-white/5">
            {mockCommunityGroups.map((g) => (
              <li
                key={g.id}
                className="px-5 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm">{g.name}</p>
                  <p className="text-xs text-neutral-400">
                    {g.members} jugadores
                  </p>
                </div>
                <a
                  href={g.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs bg-lime-500/10 border border-lime-500/30 px-3 py-1 rounded-lg text-lime-100"
                >
                  WhatsApp
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

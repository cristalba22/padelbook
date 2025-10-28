import React from "react";
import { useAuth } from "../hooks/useAuth.jsx";

// mock reservas canchas
const mockCourtBookings = [
  {
    id: 101,
    date: "2025-10-28",
    time: "19:00",
    courtName: "Cancha 2 - Blindex Premium",
    price: 9000,
    playerName: "Laura Lencina",
    status: "confirmado",
    phone: "+54 11 5555-1111",
  },
  {
    id: 102,
    date: "2025-10-28",
    time: "20:00",
    courtName: "Cancha 1 - Césped Sintético",
    price: 8000,
    playerName: "Cristian Alba",
    status: "pendiente",
    phone: "+54 11 5555-2222",
  },
  {
    id: 103,
    date: "2025-10-30",
    time: "21:00",
    courtName: "Cancha 3 - Techada",
    price: 9500,
    playerName: "Mila Dog",
    status: "confirmado",
    phone: "+54 11 5555-3333",
  },
];

// mock clases mañana
const mockLessonBookings = [
  {
    id: 201,
    date: "2025-10-28",
    time: "09:00",
    lessonName: "Clase Individual (Lucio)",
    price: 12000,
    playerName: "Bruno Pérez",
    status: "confirmado",
    phone: "+54 11 2222-4444",
  },
  {
    id: 202,
    date: "2025-10-28",
    time: "11:00",
    lessonName: "Clase Grupal (Eze)",
    price: 8000,
    playerName: "Grupo Intermedio",
    status: "pendiente",
    phone: "+54 11 3333-7777",
  },
];

export default function Admin() {
  const { user } = useAuth();

  if (!user || user.role !== "admin") {
    return (
      <section className="px-4 py-16 max-w-xl mx-auto text-center text-white">
        <h2 className="text-2xl font-bold">Acceso restringido</h2>
        <p className="text-neutral-500 text-sm mt-2">
          Tenés que iniciar sesión como administrador para ver las reservas del
          club.
        </p>
        <p className="text-neutral-600 text-xs mt-6">
          Tip: logueate con un mail que tenga la palabra "admin".
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-10 text-white">
      {/* encabezado + tarjeta admin */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <h2 className="text-white font-bold text-2xl leading-tight">
            Panel del Club
          </h2>
          <p className="text-neutral-500 text-sm max-w-xl mt-1">
            Todas las reservas confirmadas y pendientes. Podés llamar o mandar
            WhatsApp al jugador para reprogramar o cancelar.
          </p>
        </div>

        <div className="bg-neutral-900/60 rounded-xl border border-neutral-800 px-4 py-3 text-xs text-neutral-300 w-full max-w-xs shadow-[0_0_40px_rgba(163,230,53,0.15)]">
          <div className="text-white font-semibold text-sm">
            {user.name || "Administrador"}
          </div>
          <div className="text-neutral-500">{user.email || "admin@club.com"}</div>
          <div className="text-neutral-500">{user.phone || "+54 11 5555-0000"}</div>
          <div className="text-[10px] text-lime-400 font-semibold mt-2">
            Rol: {user.role ? user.role.toUpperCase() : "ADMIN"}
          </div>
        </div>
      </div>

      {/* Reservas de Canchas */}
      <div className="mt-10">
        <h3 className="text-white font-semibold text-lg mb-3">
          Reservas de Canchas
        </h3>

        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/40 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="text-neutral-400 text-[11px] uppercase tracking-wide bg-neutral-900/60 border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Cancha</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3">Jugador</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-[13px] text-neutral-200">
              {mockCourtBookings.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-800/40">
                  <td className="px-4 py-3 whitespace-nowrap text-white font-medium">
                    {b.date}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-lime-400 font-semibold">
                    {b.time} hs
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-white text-[13px] font-medium leading-tight">
                      {b.courtName}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right text-lime-400 font-semibold">
                    ${b.price}
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-white text-[13px] font-medium leading-tight">
                      {b.playerName}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={
                        "text-[11px] font-semibold px-2 py-1 rounded-md border " +
                        (b.status === "confirmado"
                          ? "text-lime-400 border-lime-400/40 bg-lime-400/10"
                          : "text-yellow-300 border-yellow-300/40 bg-yellow-300/10")
                      }
                    >
                      {b.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-[12px] text-neutral-400">
                    <div>{b.phone}</div>
                    <div className="flex gap-2 mt-1">
                      <a
                        className="text-[11px] text-lime-400 hover:underline"
                        href={`tel:${b.phone.replace(/[^+0-9]/g, "")}`}
                      >
                        Llamar
                      </a>
                      <a
                        className="text-[11px] text-lime-400 hover:underline"
                        href={`https://wa.me/${b.phone.replace(/[^0-9]/g, "")}`}
                      >
                        WhatsApp
                      </a>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[11px]">
                    <button className="text-red-400 hover:text-red-300 mr-3">
                      Cancelar
                    </button>
                    <button className="text-neutral-400 hover:text-white">
                      Reprogramar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clases con Profesor */}
      <div className="mt-12">
        <h3 className="text-white font-semibold text-lg mb-3">
          Clases con Profesor (mañana)
        </h3>

        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/40 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="text-neutral-400 text-[11px] uppercase tracking-wide bg-neutral-900/60 border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Clase</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3">Alumno / Grupo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-[13px] text-neutral-200">
              {mockLessonBookings.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-800/40">
                  <td className="px-4 py-3 whitespace-nowrap text-white font-medium">
                    {b.date}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-lime-400 font-semibold">
                    {b.time} hs
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-white text-[13px] font-medium leading-tight">
                      {b.lessonName}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right text-lime-400 font-semibold">
                    ${b.price}
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-white text-[13px] font-medium leading-tight">
                      {b.playerName}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={
                        "text-[11px] font-semibold px-2 py-1 rounded-md border " +
                        (b.status === "confirmado"
                          ? "text-lime-400 border-lime-400/40 bg-lime-400/10"
                          : "text-yellow-300 border-yellow-300/40 bg-yellow-300/10")
                      }
                    >
                      {b.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-[12px] text-neutral-400">
                    <div>{b.phone}</div>
                    <div className="flex gap-2 mt-1">
                      <a
                        className="text-[11px] text-lime-400 hover:underline"
                        href={`tel:${b.phone.replace(/[^+0-9]/g, "")}`}
                      >
                        Llamar
                      </a>
                      <a
                        className="text-[11px] text-lime-400 hover:underline"
                        href={`https://wa.me/${b.phone.replace(/[^0-9]/g, "")}`}
                      >
                        WhatsApp
                      </a>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-[11px]">
                    <button className="text-red-400 hover:text-red-300 mr-3">
                      Cancelar
                    </button>
                    <button className="text-neutral-400 hover:text-white">
                      Reprogramar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-neutral-600 mt-6">
          Estos datos son mock locales. En producción van a salir de la API del
          club.
        </p>
      </div>
    </section>
  );
}

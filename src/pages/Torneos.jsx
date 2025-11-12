// src/pages/Torneos.jsx
import React from "react";
import { useAuth } from "../hooks/useAuth.jsx";

const torneoActual = {
  id: 1,
  nombre: "Relámpago nocturno",
  fecha: "Viernes 21:00",
  costo: 6000,
  cupo: 16,
  inscriptos: 9,
  categoria: "libre / pareja",
  premio: "Vouchers + ranking del club",
  whatsapp: "https://wa.me/543511234567", // de ejemplo
};

const proximosTorneos = [
  {
    id: 2,
    nombre: "Mixto finde",
    fecha: "Sábado 18:00",
    costo: 7000,
    cupo: 12,
  },
  {
    id: 3,
    nombre: "7ma / 6ta Puntable",
    fecha: "Domingo 16:30",
    costo: 6500,
    cupo: 16,
  },
];

const torneosJugadosMock = [
  {
    id: 200,
    nombre: "Relámpago viernes",
    fecha: "2025-10-05",
    resultado: "Semifinal",
    puntos: 45,
  },
  {
    id: 201,
    nombre: "Copa Primavera",
    fecha: "2025-09-15",
    resultado: "Campeón",
    puntos: 120,
  },
];

export default function Torneos() {
  const { user } = useAuth();

  const handleInscribirme = (torneo) => {
    // acá iría el POST al backend
    alert(
      `Te anotamos (mock) al torneo: ${torneo.nombre}. El club te confirma por WhatsApp.`
    );
  };

  return (
    <div className="min-h-screen pt-24 pb-16 max-w-6xl mx-auto px-4 text-white">
      {/* encabezado */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Torneos relámpago
          </h1>
          <p className="text-sm text-neutral-400">
            Inscribite solo o en pareja. Eliminación directa, se juega en una
            noche.
          </p>
        </div>
        <span className="text-xs bg-lime-500/10 text-lime-300 px-3 py-1 rounded-full border border-lime-500/30">
          Mock • sin backend
        </span>
      </div>

      {/* torneo actual */}
      <div className="bg-[#101010] border border-white/5 rounded-2xl p-5 mb-8 shadow-[0_0_40px_rgba(132,204,22,0.05)]">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <p className="text-[11px] uppercase text-lime-300 tracking-wide mb-1">
              Torneo de esta semana
            </p>
            <h2 className="text-xl font-semibold mb-2">{torneoActual.nombre}</h2>
            <p className="text-sm text-neutral-300 mb-1">
              {torneoActual.fecha} · Máx {torneoActual.cupo} parejas · $
              {torneoActual.costo}
            </p>
            <p className="text-xs text-neutral-500">
              {torneoActual.premio} · Cat: {torneoActual.categoria}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-neutral-400">
              Inscriptos:{" "}
              <span className="text-white font-medium">
                {torneoActual.inscriptos}/{torneoActual.cupo}
              </span>
            </p>
            <button
              onClick={() => handleInscribirme(torneoActual)}
              className="bg-lime-500 hover:bg-lime-400 text-black text-sm font-medium px-4 py-2 rounded-lg transition shadow-[0_0_25px_rgba(190,242,100,0.3)]"
            >
              Anotarme
            </button>
            <a
              href={torneoActual.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-lime-300 hover:text-lime-100 underline underline-offset-2"
            >
              Escribir al club →
            </a>
          </div>
        </div>
      </div>

      {/* próximos torneos */}
      <div className="mb-10">
        <h3 className="text-sm font-semibold text-neutral-200 mb-3">
          Próximos torneos
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {proximosTorneos.map((t) => (
            <div
              key={t.id}
              className="bg-[#0d0d0d] border border-white/5 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{t.nombre}</p>
                <p className="text-xs text-neutral-400">{t.fecha}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Cupo: {t.cupo} · ${t.costo}
                </p>
              </div>
              <button
                onClick={() => handleInscribirme(t)}
                className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5"
              >
                Anotarme
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* historial del jugador */}
      <div className="bg-black/10 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-200">
            Tus torneos jugados
          </h3>
          <p className="text-xs text-neutral-500">
            {user ? `Jugador: ${user.name || user.email}` : "No logueado"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="py-2">Torneo</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Resultado</th>
                <th className="py-2">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {torneosJugadosMock.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-2">{row.nombre}</td>
                  <td className="py-2 text-neutral-400">{row.fecha}</td>
                  <td className="py-2">
                    <span className="text-xs bg-lime-500/10 text-lime-200 px-2 py-1 rounded-full border border-lime-500/20">
                      {row.resultado}
                    </span>
                  </td>
                  <td className="py-2 text-neutral-100">{row.puntos}</td>
                </tr>
              ))}
              {!torneosJugadosMock.length && (
                <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-neutral-500 text-xs"
                    >
                      Todavía no jugaste torneos desde esta cuenta.
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

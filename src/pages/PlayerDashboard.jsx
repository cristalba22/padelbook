// src/pages/PlayerDashboard.jsx
import React from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { bookings = [], cancelBooking } = useBooking();

  // si no hay user, lo mandaría al login (pero como la ruta es privada casi no pasa)
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-white/70">
        Tenés que ingresar para ver tus turnos.
      </div>
    );
  }

  // filtramos SOLO las reservas del usuario actual
  const myBookings = bookings.filter(
    (b) => b.userEmail === user.email || b.playerName === user.name
  );

  return (
    <main className="max-w-5xl mx-auto py-16 px-4 text-white">
      <h1 className="text-2xl font-semibold mb-6">Mis turnos</h1>
      <p className="text-sm text-white/40 mb-6">
        Acá ves todo lo que reservaste desde tu cuenta. Podés cancelar si no
        podés ir.
      </p>

      <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 gap-2 px-6 py-3 text-xs text-white/40 border-b border-white/5">
          <span>Fecha</span>
          <span>Hora</span>
          <span>Detalle</span>
          <span>Estado</span>
          <span className="text-right">Acción</span>
        </div>

        {myBookings.length === 0 ? (
          <div className="px-6 py-6 text-sm text-white/40">
            No tenés reservas todavía.
          </div>
        ) : (
          myBookings.map((b) => (
            <div
              key={b.id}
              className="grid grid-cols-5 gap-2 px-6 py-3 items-center border-b border-white/5 last:border-b-0 text-sm"
            >
              <span>{b.date}</span>
              <span>{b.time}</span>
              <span>{b.courtName}</span>
              <span>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    b.status === "cancelado"
                      ? "bg-red-500/10 text-red-300"
                      : "bg-lime-500/10 text-lime-300"
                  }`}
                >
                  {b.status}
                </span>
              </span>
              <span className="text-right">
                {b.status !== "cancelado" && (
                  <button
                    onClick={() => cancelBooking(b.id)}
                    className="text-xs text-red-200 hover:text-red-100"
                  >
                    Cancelar
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

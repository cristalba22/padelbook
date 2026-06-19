import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import LoginModal from "./LoginModal.jsx";

export default function BookingSummary() {
  const { user } = useAuth();
  const { selection, selectedDate, clearBooking } = useBooking();
  const [showLogin, setShowLogin] = useState(false);

  if (!selection) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-neutral-500 text-sm">
        No hay turno seleccionado aún.
      </div>
    );
  }

  function handleConfirm() {
    if (!user) {
      // 👈 si no hay usuario logueado, abrimos el modal
      setShowLogin(true);
      return;
    }

    // Acá iría la lógica real de confirmación de turno (API, etc.)
    alert(
      `Turno confirmado:\n${selection.courtName}\n${selectedDate} ${selection.time}hs\n$${selection.price}`
    );
    clearBooking();
  }

  return (
    <>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-[0_0_40px_rgba(163,230,53,0.15)]">
        <div className="flex items-start justify-between">
          <div className="text-white font-semibold text-sm">
            Resumen de Reserva
          </div>
          <button
            onClick={clearBooking}
            className="text-[11px] text-neutral-500 hover:text-red-400"
          >
            borrar
          </button>
        </div>

        <div className="mt-3 text-xs text-neutral-300 space-y-1">
          <div>
            <span className="text-neutral-500">Cancha: </span>
            {selection.courtName}
          </div>
          <div>
            <span className="text-neutral-500">Fecha: </span>
            {selectedDate}
          </div>
          <div>
            <span className="text-neutral-500">Horario: </span>
            {selection.time} hs
          </div>
          <div>
            <span className="text-neutral-500">Precio: </span>${selection.price}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          className="w-full mt-4 rounded-full bg-lime-400 text-neutral-900 text-sm font-semibold py-2 shadow-[0_0_25px_rgba(190,230,53,0.6)] hover:bg-lime-300 hover:scale-[1.02] active:scale-[0.98] transition"
        >
          Confirmar Turno
        </button>

        {!user && (
          <p className="text-[11px] text-neutral-500 text-center mt-2">
            Necesitas iniciar sesión
          </p>
        )}
      </div>

      {/* 👇 AHORA el modal se controla con isOpen */}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLoggedIn={() => setShowLogin(false)}
      />
    </>
  );
}

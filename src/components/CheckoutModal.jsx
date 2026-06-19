// src/components/CheckoutModal.jsx
import React from "react";

export default function CheckoutModal({ open, onClose, selected }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000]">
      <div className="bg-[#111] border border-lime-500/20 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-white text-lg font-semibold mb-4">
          Confirmar Reserva
        </h2>

        <div className="bg-black/20 rounded-lg p-4 mb-5 text-sm text-white/80 space-y-1">
          <p>
            <strong>Cancha / Clase:</strong> {selected?.courtName}
          </p>
          <p>
            <strong>Fecha:</strong> {selected?.date}
          </p>
          <p>
            <strong>Horario:</strong> {selected?.time}
          </p>
          <p className="text-lime-400 font-semibold pt-2">
            Total: ${selected?.price}
          </p>
        </div>

        <div className="space-y-3">
          <button
            className="w-full bg-lime-500 hover:bg-lime-400 text-black font-semibold py-2 rounded-lg transition"
            onClick={() => {
              alert("Simular Mercado Pago (50%)");
              onClose();
            }}
          >
            Pagar seña (50%)
          </button>

          <button
            className="w-full bg-lime-600/20 hover:bg-lime-500/40 text-white font-semibold py-2 rounded-lg transition border border-lime-500/30"
            onClick={() => {
              alert("Simular Mercado Pago (total)");
              onClose();
            }}
          >
            Pagar todo ahora
          </button>

          <button
            className="w-full bg-black/30 hover:bg-black/50 text-white font-semibold py-2 rounded-lg transition border border-white/5"
            onClick={() => {
              alert("Se paga en el club 👌");
              onClose();
            }}
          >
            Pagar en el club (efectivo / transferencia)
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 text-sm text-white/40 hover:text-white/70 transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

import React from "react";
import { motion } from "framer-motion";
import { useBooking } from "../hooks/useBooking.jsx";

export default function CheckoutModal({ booking, onClose }) {
  const { savePendingBooking } = useBooking();

  if (!booking) return null;

  const confirmAndStore = (metodo) => {
    // armamos objeto reserva para guardar
    const bookingToStore = {
      ...booking,
      metodoPago: metodo,
      estadoPago:
        metodo === "pagar_todo"
          ? "pagado"
          : metodo === "senal"
          ? "seña pendiente"
          : "pagar en el club",
      estadoTurno:
        metodo === "pagar_todo"
          ? "confirmado"
          : "pendiente de pago",
    };

    savePendingBooking(bookingToStore);

    alert(
      "Reserva confirmada ✅\nSe guardó en tus turnos.\n(En producción se integra el pago)"
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-sm text-sm text-neutral-300 shadow-[0_0_40px_rgba(163,230,53,0.3)]"
      >
        <h3 className="text-lg font-bold text-white mb-4">
          Confirmar Reserva
        </h3>

        <p className="text-sm text-neutral-400 mb-1">
          Cancha / Clase:{" "}
          <span className="text-white font-semibold">
            {booking.courtName || booking.lessonName || "—"}
          </span>
        </p>
        <p className="text-sm text-neutral-400 mb-1">
          Fecha:{" "}
          <span className="text-white font-semibold">{booking.date}</span>
        </p>
        <p className="text-sm text-neutral-400 mb-1">
          Horario:{" "}
          <span className="text-lime-400 font-semibold">{booking.time} hs</span>
        </p>
        <p className="text-sm text-neutral-400 mb-4">
          Total:{" "}
          <span className="text-lime-400 font-semibold">
            ${booking.price}
          </span>
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => confirmAndStore("senal")}
            className="bg-lime-400 text-neutral-900 font-semibold py-2 rounded-lg hover:scale-[1.03] active:scale-[0.97] transition"
          >
            Pagar seña (50%)
          </button>

          <button
            onClick={() => confirmAndStore("pagar_todo")}
            className="bg-lime-600/90 text-white font-semibold py-2 rounded-lg hover:bg-lime-500/90 transition"
          >
            Pagar todo ahora
          </button>

          <button
            onClick={() => confirmAndStore("pagar_en_club")}
            className="bg-neutral-800 border border-neutral-700 text-neutral-300 font-semibold py-2 rounded-lg hover:bg-neutral-700 transition"
          >
            Pagar en el club (efectivo / transferencia)
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-neutral-500 text-xs mt-4 hover:text-neutral-300"
        >
          Cerrar
        </button>
      </motion.div>
    </div>
  );
}

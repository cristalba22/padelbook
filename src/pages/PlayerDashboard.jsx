import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import { motion, AnimatePresence } from "framer-motion";

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { getPendingBookings, removeBooking } = useBooking();

  const [bookings, setBookings] = useState([]);
  const [confirmIndex, setConfirmIndex] = useState(null); // índice que quiero cancelar

  // cargar reservas guardadas
  useEffect(() => {
    setBookings(getPendingBookings());
  }, [getPendingBookings]);

  // handler para abrir confirmación
  const askCancel = (idx) => {
    setConfirmIndex(idx);
  };

  // cerrar confirmación sin borrar
  const closeConfirm = () => {
    setConfirmIndex(null);
  };

  // confirmar cancelación
  const doCancel = () => {
    if (confirmIndex === null) return;
    const updated = removeBooking(confirmIndex);
    setBookings(updated);
    setConfirmIndex(null);
  };

  if (!user) {
    return (
      <section className="px-4 py-16 max-w-xl mx-auto text-center text-white">
        <h2 className="text-2xl font-bold">Iniciá sesión</h2>
        <p className="text-neutral-500 text-sm mt-2">
          Tenés que iniciar sesión para ver tus turnos.
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-10 text-white">
      <h2 className="text-white font-bold text-2xl leading-tight">
        Mis Turnos
      </h2>
      <p className="text-neutral-500 text-sm max-w-xl mt-2">
        Acá ves tus próximas reservas. Pagaste todo, dejaste seña o pagás en el
        club. También podés cancelar si no podés ir.
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/40 shadow-[0_0_30px_rgba(0,0,0,0.6)] mt-8">
        <table className="w-full text-left text-sm min-w-[700px]">
          <thead className="text-neutral-400 text-[11px] uppercase tracking-wide bg-neutral-900/60 border-b border-neutral-800">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Cancha / Clase</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3">Estado turno</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Acción</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-800 text-[13px] text-neutral-200">
            <AnimatePresence initial={false}>
              {bookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-neutral-500 text-sm"
                  >
                    No tenés turnos todavía.
                  </td>
                </tr>
              ) : (
                bookings.map((b, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, scale: 0.98, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="hover:bg-neutral-800/40"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-white font-medium">
                      {b.date}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-lime-400 font-semibold">
                      {b.time} hs
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-white text-[13px] font-medium leading-tight">
                        {b.courtName || b.lessonName || "Turno"}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right text-lime-400 font-semibold">
                      ${b.price}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          "text-[11px] font-semibold px-2 py-1 rounded-md border " +
                          (b.estadoTurno === "confirmado"
                            ? "text-lime-400 border-lime-400/40 bg-lime-400/10"
                            : "text-yellow-300 border-yellow-300/40 bg-yellow-300/10")
                        }
                      >
                        {b.estadoTurno}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[12px] text-neutral-400">
                      {b.estadoPago} <br />
                      <span className="text-neutral-500 text-[11px] italic">
                        {b.metodoPago === "pagar_en_club"
                          ? "Pagás al llegar"
                          : b.metodoPago === "senal"
                          ? "Falta abonar seña"
                          : b.metodoPago === "pagar_todo"
                          ? "Pagado completo"
                          : ""}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[11px] text-right">
                      <button
                        className="text-red-400 hover:text-red-300 mr-4"
                        onClick={() => askCancel(i)}
                      >
                        Cancelar
                      </button>
                      <button className="text-neutral-400 hover:text-white">
                        Ver comprobante
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-neutral-600 mt-6">
        Datos guardados localmente en tu navegador. En producción va a estar
        ligado a tu cuenta real.
      </p>

      {/* MODAL CONFIRMAR CANCELACIÓN */}
      <AnimatePresence>
        {confirmIndex !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-sm p-6 text-sm text-neutral-300 shadow-[0_0_35px_rgba(0,0,0,0.8)]"
            >
              <h3 className="text-white font-bold text-lg mb-2">
                Cancelar turno
              </h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                ¿Seguro que querés cancelar este turno?
                El club podría volver a ofrecer este horario a otra persona.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-6 text-[13px]">
                <button
                  onClick={doCancel}
                  className="flex-1 bg-red-500/90 hover:bg-red-500 text-white font-semibold py-2 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.4)] transition"
                >
                  Sí, cancelar
                </button>

                <button
                  onClick={closeConfirm}
                  className="flex-1 bg-neutral-800 border border-neutral-700 text-neutral-300 font-semibold py-2 rounded-lg hover:bg-neutral-700 transition"
                >
                  Volver
                </button>
              </div>

              <div className="text-[11px] text-neutral-600 mt-4">
                (En producción, esto también avisa al club)
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

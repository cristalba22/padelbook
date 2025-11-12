// src/pages/Booking.jsx
import React, { useState } from "react";
import { useBooking } from "../hooks/useBooking.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { courts } from "../data/courts.js";
import { mockSlots } from "../data/slots.js";

export default function Booking() {
  const { user } = useAuth();
  const { selectedBooking, setSelectedBooking, addBooking } = useBooking();
  const [date, setDate] = useState("2025-11-07");
  const [showModal, setShowModal] = useState(false);

  // slots por cancha
  function getSlotsForCourt(courtId) {
    return mockSlots.filter((s) => s.courtId === courtId);
  }

  function handleSelect(court, slot) {
    setSelectedBooking({
      date,
      time: slot.time,
      price: slot.price,
      courtId: court.id,
      courtName: court.name,
      playerName: user?.name || "",
      userEmail: user?.email || "",
    });
  }

  function handleConfirm(method) {
    if (!selectedBooking) return;
    // lo guardamos en contexto
    addBooking({
      ...selectedBooking,
      payMethod: method,
    });
    setShowModal(false);
    // podrías hacer un toast acá
  }

  return (
    <main className="max-w-6xl mx-auto py-14 px-4 text-white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Reservar turno</h1>
          <p className="text-sm text-white/40">
            Elegí fecha, cancha o clase, y horario disponible. Confirmás en un
            toque.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-sm text-white/40">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr] lg:grid-cols-[1fr,280px] gap-6">
        {/* col izquierda: canchas */}
        <div className="grid md:grid-cols-3 gap-5">
          {courts.map((court) => (
            <div
              key={court.id}
              className="bg-[#111] rounded-xl border border-white/5 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-white/30">Cancha / Clase</p>
                  <h2 className="font-medium">{court.name}</h2>
                  {court.note && (
                    <p className="text-[10px] text-white/30 mt-1">
                      {court.note}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/30">Desde $</p>
                  <p className="text-sm text-lime-400 font-semibold">
                    ${court.basePrice}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {getSlotsForCourt(court.id).map((slot) => {
                  const isSelected =
                    selectedBooking &&
                    selectedBooking.courtId === court.id &&
                    selectedBooking.time === slot.time;
                  return (
                    <button
                      key={slot.time}
                      onClick={() => handleSelect(court, slot)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                        slot.isAvailable
                          ? "border-white/5 hover:border-lime-400/60 hover:bg-lime-400/5"
                          : "border-white/5 opacity-40 cursor-not-allowed"
                      } ${isSelected ? "border-lime-400 bg-lime-400/10" : ""}`}
                      disabled={!slot.isAvailable}
                    >
                      <span>{slot.time}</span>
                      <span className="text-lime-400 text-xs">
                        ${slot.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* col derecha: resumen */}
        <div className="bg-[#111] rounded-xl border border-white/5 p-5 h-fit">
          {selectedBooking ? (
            <>
              <p className="text-sm text-white/40 mb-2">
                Cancha / Clase seleccionada:
              </p>
              <p className="font-medium">{selectedBooking.courtName}</p>
              <p className="text-sm mt-1">
                Fecha: <span className="text-white/60">{selectedBooking.date}</span>
              </p>
              <p className="text-sm">
                Horario:{" "}
                <span className="text-white/60">{selectedBooking.time}</span>
              </p>
              <p className="text-sm mb-4">
                Precio:{" "}
                <span className="text-lime-400 font-semibold">
                  ${selectedBooking.price}
                </span>
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="w-full bg-lime-400 text-black font-semibold py-2 rounded-lg hover:bg-lime-300 transition"
              >
                Continuar
              </button>
              <button
                onClick={() => setSelectedBooking(null)}
                className="block mx-auto mt-3 text-xs text-white/30 hover:text-white/60"
              >
                Cambiar selección
              </button>
            </>
          ) : (
            <p className="text-sm text-white/40">
              No hay turno seleccionado aún. Seleccioná una cancha y un horario
              para continuar.
            </p>
          )}
        </div>
      </div>

      {/* modal de confirmación */}
      {showModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-[#111] border border-lime-400/20 rounded-xl w-full max-w-md p-6 text-white shadow-2xl">
            <h2 className="text-lg font-semibold mb-4">Confirmar Reserva</h2>
            <p className="text-sm mb-1">
              Cancha / Clase:{" "}
              <span className="text-white/70">{selectedBooking.courtName}</span>
            </p>
            <p className="text-sm mb-1">
              Fecha:{" "}
              <span className="text-white/70">{selectedBooking.date}</span>
            </p>
            <p className="text-sm mb-3">
              Horario:{" "}
              <span className="text-white/70">{selectedBooking.time}</span>
            </p>
            <p className="text-sm mb-4">
              Total:{" "}
              <span className="text-lime-400 font-semibold">
                ${selectedBooking.price}
              </span>
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleConfirm("seña")}
                className="bg-lime-400 text-black py-2 rounded-lg font-semibold"
              >
                Pagar seña (50%)
              </button>
              <button
                onClick={() => handleConfirm("full")}
                className="bg-white/5 border border-white/5 py-2 rounded-lg font-semibold"
              >
                Pagar todo ahora
              </button>
              <button
                onClick={() => handleConfirm("club")}
                className="bg-white/5 border border-white/5 py-2 rounded-lg text-sm"
              >
                Pagar en el club (efectivo / transferencia)
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="text-xs text-white/40 mt-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

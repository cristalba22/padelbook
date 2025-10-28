import React, { useState } from "react";
import { useBooking } from "../hooks/useBooking.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import CheckoutModal from "../components/CheckoutModal.jsx";

// utilidad: saber si fecha es día hábil (1-5)
function isWeekday(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 dom, 6 sab
  return day >= 1 && day <= 5;
}

export default function Booking() {
  const {
    selectedDate,
    setSelectedDate,
    selectedCourt,
    setSelectedCourt,
    selectedTime,
    setSelectedTime,
  } = useBooking();

  const { user } = useAuth();
  const navigate = useNavigate();

  const [checkoutBooking, setCheckoutBooking] = useState(null);

  // canchas tarde/noche
  const courts = [
    {
      id: 1,
      name: "Cancha 1 - Césped Sintético",
      basePrice: 8000,
      tag: "Tech / LED / Blindex",
      slots: [
        { time: "18:00", price: 8000, available: false },
        { time: "19:00", price: 8000, available: true },
        { time: "20:00", price: 8000, available: true },
      ],
    },
    {
      id: 2,
      name: "Cancha 2 - Blindex Premium",
      basePrice: 9000,
      tag: "Tech / LED / Blindex",
      slots: [
        { time: "18:00", price: 9000, available: true },
        { time: "19:00", price: 9000, available: false },
        { time: "20:00", price: 9000, available: true },
      ],
    },
    {
      id: 3,
      name: "Cancha 3 - Techada",
      basePrice: 9500,
      tag: "Tech / LED / Blindex",
      slots: [
        { time: "18:00", price: 9500, available: true },
        { time: "19:00", price: 9500, available: true },
        { time: "20:00", price: 9500, available: false },
      ],
    },
  ];

  // clases mañana (Lucio individual, Eze grupal hasta 4)
  const lessonSlotsWeekday = [
    {
      time: "09:00",
      price: 12000,
      note: "Clase Individual (Lucio) · técnica 1 a 1",
      available: true,
    },
    {
      time: "10:00",
      price: 12000,
      note: "Clase Individual (Lucio) · corrección de golpes",
      available: true,
    },
    {
      time: "11:00",
      price: 8000,
      note: "Clase Grupal (Eze) · hasta 4 jugadores",
      available: true,
    },
  ];

  const lessonSlotsWeekend = [
    {
      time: "09:00",
      price: 12000,
      note: "Sólo con reserva directa al profe",
      available: false,
    },
    {
      time: "10:00",
      price: 12000,
      note: "Consultá al club",
      available: false,
    },
  ];

  const classesBlock = {
    id: "clases",
    name: "Clases con profesor",
    basePrice: null,
    tag: "Lucio / Eze (mañana)",
    slots: isWeekday(selectedDate) ? lessonSlotsWeekday : lessonSlotsWeekend,
  };

  const allBlocks = [...courts, classesBlock];

  function onDateChange(e) {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setSelectedCourt(null);
    setSelectedTime(null);
  }

  function handleSelect(block, slot) {
    if (!slot.available) return;

    // si no está logueado -> mandarlo a account
    if (!user) {
      navigate("/account");
      return;
    }

    setSelectedCourt(block);
    setSelectedTime(slot);

    // abrir modal de checkout
    setCheckoutBooking({
      courtName: block.name,
      date: selectedDate,
      time: slot.time,
      price: slot.price,
    });
  }

  function closeModal() {
    setCheckoutBooking(null);
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-10 text-white">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <h2 className="text-white font-bold text-2xl leading-tight">
            Reservar turno
          </h2>
          <p className="text-neutral-500 text-sm max-w-lg">
            Elegí fecha, cancha o clase, y horario disponible.
            Confirmás en un toque.
          </p>

          <div className="text-neutral-500 text-xs mt-3">
            Fecha seleccionada:{" "}
            <span className="text-neutral-300 font-medium">
              {selectedDate}
            </span>
          </div>
        </div>

        {/* selector de fecha */}
        <div className="flex flex-col items-start gap-2 text-sm">
          <label className="text-neutral-400 text-xs font-medium">Fecha</label>
          <div className="bg-neutral-900/60 border border-neutral-700 text-white rounded-lg px-3 py-2 flex items-center gap-2 text-sm shadow-[0_0_20px_rgba(0,0,0,0.6)]">
            <input
              type="date"
              value={selectedDate}
              onChange={onDateChange}
              className="bg-transparent text-white text-sm focus:outline-none"
            />
            <span className="text-neutral-500 text-xs">📅</span>
          </div>
        </div>
      </div>

      {/* bloques canchas y clases */}
      <div className="mt-8 flex flex-col lg:flex-row flex-wrap gap-6">
        {allBlocks.map((block) => (
          <div
            key={block.id}
            className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-200 min-w-[260px] max-w-[360px] flex-1 shadow-[0_0_30px_rgba(0,0,0,0.6)]"
          >
            {/* header bloque */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-white font-semibold text-[13px] leading-tight">
                  {block.name}
                </div>

                {block.basePrice ? (
                  <div className="text-neutral-500 text-[11px]">
                    Desde ${block.basePrice}
                  </div>
                ) : (
                  <div className="text-neutral-500 text-[11px]">
                    Turnos con profe (mañana)
                  </div>
                )}
              </div>

              <div className="text-[10px] text-neutral-400 border border-neutral-700 bg-neutral-800/40 rounded-md px-2 py-1 mt-2 sm:mt-0">
                {block.tag}
              </div>
            </div>

            {/* slots */}
            <div className="flex flex-wrap gap-2 mt-4">
              {block.slots.map((slot, idx) => {
                const isSelected =
                  selectedCourt?.id === block.id &&
                  selectedTime?.time === slot.time;

                return (
                  <button
                    key={idx}
                    disabled={!slot.available}
                    onClick={() => handleSelect(block, slot)}
                    className={
                      "flex flex-col text-left items-start gap-1 text-xs px-3 py-2 rounded-md border min-w-[110px] max-w-[150px] transition-all duration-200 " +
                      (isSelected
                        ? "border-lime-400 bg-lime-400/10 text-lime-300 shadow-[0_0_12px_rgba(163,230,53,0.6)]"
                        : slot.available
                        ? "border-neutral-700 bg-neutral-900/60 text-white hover:border-lime-400 hover:text-lime-400 cursor-pointer"
                        : "border-neutral-800 bg-neutral-900/30 text-neutral-600 line-through cursor-not-allowed")
                    }
                  >
                    <div className="font-semibold leading-none text-white">
                      {slot.time} hs
                    </div>

                    {slot.note && (
                      <div className="text-[10px] text-neutral-500 leading-tight italic">
                        {slot.note}
                      </div>
                    )}

                    <div className="text-lime-400 font-semibold leading-none">
                      ${slot.price}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* resumen selección */}
      <div className="mt-8 bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300 shadow-[0_0_30px_rgba(0,0,0,0.6)] min-h-[60px]">
        {selectedCourt && selectedTime ? (
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="text-neutral-300 text-[13px] leading-relaxed">
              <div>
                <span className="text-neutral-500">Cancha / Clase:</span>{" "}
                <span className="text-white font-medium">
                  {selectedCourt.name}
                </span>
              </div>
              <div>
                <span className="text-neutral-500">Fecha:</span>{" "}
                <span className="text-white font-medium">{selectedDate}</span>
              </div>
              <div>
                <span className="text-neutral-500">Horario:</span>{" "}
                <span className="text-lime-400 font-semibold">
                  {selectedTime.time} hs
                </span>
              </div>
              <div>
                <span className="text-neutral-500">Precio:</span>{" "}
                <span className="text-lime-400 font-semibold">
                  ${selectedTime.price}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-[12px]">
              <button
                onClick={() =>
                  setCheckoutBooking({
                    courtName: selectedCourt.name,
                    date: selectedDate,
                    time: selectedTime.time,
                    price: selectedTime.price,
                  })
                }
                className="bg-lime-400 text-neutral-900 font-semibold px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(163,230,53,0.6)] hover:scale-[1.02] active:scale-[0.98] transition"
              >
                Continuar
              </button>

              <button
                onClick={() => {
                  setSelectedCourt(null);
                  setSelectedTime(null);
                }}
                className="text-neutral-500 hover:text-white underline"
              >
                Cambiar selección
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[13px] text-neutral-500">
            {user
              ? "Tocá un horario disponible para continuar."
              : "Iniciá sesión para reservar un horario."}
          </div>
        )}
      </div>

      {/* modal checkout */}
      <AnimatePresence>
        {checkoutBooking && (
          <CheckoutModal booking={checkoutBooking} onClose={closeModal} />
        )}
      </AnimatePresence>
    </section>
  );
}

// src/pages/Booking.jsx
import React, { useMemo, useState } from "react";

import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import { useSchedule, sameSlot } from "../hooks/useSchedule.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { COURTS, CLASS_HOURS, COURT_HOURS, PAYMENT_OPTIONS } from "../data/bookingConfig.js";
import { getClassPrice, getCourtPrice } from "../utils/pricing.js";
import { loadTeachers } from "../utils/teachersStorage.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function Booking() {
  const { user, openLogin } = useAuth();
  const { bookings, addBooking, setSelectedBooking } = useBooking();
  const { notify } = useToast();
  const { getBlock, isBlocked } = useSchedule();
  const { prices } = usePricing();
  const activeTeachers = useMemo(() => loadTeachers(prices.classPrice).filter((teacher) => teacher.status === "activo"), [prices.classPrice]);
  const primaryTeacher = activeTeachers[0] || null;
  // Día seleccionado (por defecto hoy)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10); // yyyy-mm-dd
  });

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [paymentOption, setPaymentOption] = useState(null);
  const [confirmationMsg, setConfirmationMsg] = useState("");

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(selectedDate + "T00:00:00");
      return d.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const handleSelectSlot = (court, hour, type) => {
    if (isSlotTaken(court.id, hour)) return;
    const price = type === "class" ? getClassPrice(prices) : getCourtPrice(hour, selectedDate, prices);

    setSelectedSlot({
      courtId: court.id,
      courtName: court.name,
      hour,
      price,
      type, // "class" | "court"
      teacherId: type === "class" ? primaryTeacher?.id : null,
      teacherName: type === "class" ? primaryTeacher?.name : "",
      description: type === "class" ? "Clase con profesor" : "Turno de pádel",
    });
    setConfirmationMsg("");
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !paymentOption) return;
    if (!user) {
      openLogin();
      setConfirmationMsg("Ingresá para confirmar la reserva y guardarla en tu cuenta.");
      notify({ type: "info", title: "Ingresá para reservar", message: "Después de iniciar sesión volvés al flujo con el horario seleccionado." });
      return;
    }

    if (isSlotTaken(selectedSlot.courtId, selectedSlot.hour)) {
      setSelectedSlot(null);
      setPaymentOption(null);
      setConfirmationMsg("Ese horario ya no está disponible. Elegí otro turno para continuar.");
      notify({ type: "warning", title: "Horario ocupado", message: "Ese turno acaba de dejar de estar disponible." });
      return;
    }

    const payload = {
      ...selectedSlot,
      paymentOption,
      date: selectedDate,
      createdAt: new Date().toISOString(),
      userEmail: user.email,
      playerName: user.name,
      time: selectedSlot.hour,
      paymentMethod:
        paymentOption === "cash" ? "Paga en el club" : "Mercado Pago",
    };

    const savedBooking = await addBooking(payload);
    if (savedBooking?.duplicated) {
      setConfirmationMsg("Ese horario ya fue reservado. Elegí otro turno disponible.");
      notify({ type: "warning", title: "Reserva duplicada", message: "Probá con otro horario disponible." });
      return;
    }
    setSelectedBooking(savedBooking);

    let message = "";
    if (paymentOption === "deposit") {
      const deposit = Math.round(selectedSlot.price * 0.3);
      message = `Reserva guardada en tu cuenta. Se registró la seña de $${deposit.toLocaleString(
        "es-AR"
      )}.`;
    } else if (paymentOption === "full") {
      message =
        "Reserva guardada en tu cuenta. El turno quedó registrado con pago total.";
    } else {
      message =
        "Reserva guardada como 'paga en el club'. El administrador la verá como pendiente hasta registrar el pago.";
    }

    setConfirmationMsg(message);
    notify({ type: "success", title: "Reserva guardada", message });
  };


  function getSlotState(courtId, hour) {
    const block = getBlock(selectedDate, courtId, hour);
    const reserved = bookings.find((booking) => sameSlot(booking, selectedDate, courtId, hour));
    return { block, reserved, taken: Boolean(block || reserved) };
  }

  function isSlotTaken(courtId, hour) {
    return isBlocked(selectedDate, courtId, hour) || bookings.some((booking) => sameSlot(booking, selectedDate, courtId, hour));
  }

  const depositAmount = useMemo(() => {
    if (!selectedSlot) return 0;
    return Math.round(selectedSlot.price * 0.3);
  }, [selectedSlot]);

  const totalAmount = selectedSlot?.price || 0;

  return (
    <main className="main-container pt-24 text-white">
      {/* Encabezado */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">
            Reservas · Paso 2
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1 tracking-tight">
            Reservar turno
          </h1>
          <p className="text-sm text-white/60 mt-1 max-w-xl">
            Elegí día, cancha o clase, seleccioná la forma de pago y confirmá tu turno en pocos pasos.
          </p>
        </div>

        {/* Selector de fecha */}
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">
            Fecha del turno
          </p>
          <div className="mt-1 flex items-center gap-3 justify-end">
            <span className="text-sm font-medium">{formattedDate}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);
                setPaymentOption(null);
                setConfirmationMsg("");
              }}
              className="bg-black/60 border border-white/20 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lime-300/60"
            />
          </div>
          <p className="text-[11px] text-white/40 mt-1">
            Podés cambiarla desde acá sin volver al paso 1.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] gap-8">
        {/* Columna izquierda: Canchas y horarios */}
        <div className="space-y-5">
          {COURTS.map((court) => (
            <article
              key={court.id}
              className="rounded-3xl border border-slate-800/90 bg-[#050814]/80 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Header cancha */}
              <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4 bg-gradient-to-r from-white/5 via-white/0 to-transparent">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-lime-300/90">
                    Cancha / Clase
                  </p>
                  <h2 className="mt-1 text-sm md:text-base font-semibold">
                    {court.name}
                  </h2>
                  <p className="text-[11px] text-white/60 mt-1">{court.description}</p>
                  <p className="mt-1 text-[11px] text-lime-300/80">{court.tag}</p>
                  <p className="mt-1 text-[11px] text-white/45">Profes activos: {activeTeachers.map((t) => t.nickname || t.name).slice(0, 3).join(" · ")}</p>
                </div>

                {/* Mini resumen de precios */}
                <div className="hidden sm:block text-right text-[11px] text-white/60 space-y-1">
                  <div>
                    <span className="block text-white/40 uppercase tracking-[0.18em]">
                      Clases 09–13
                    </span>
                    <span className="font-semibold text-lime-300">
                      ${getClassPrice(prices).toLocaleString("es-AR")}
                    </span>
                  </div>
                  <div>
                    <span className="block text-white/40 uppercase tracking-[0.18em]">
                      Pádel 13–19
                    </span>
                    <span className="font-semibold text-lime-300">
                      ${getCourtPrice("15:00", selectedDate, prices).toLocaleString("es-AR")}
                    </span>
                  </div>
                  <div>
                    <span className="block text-white/40 uppercase tracking-[0.18em]">
                      Noche desde 19
                    </span>
                    <span className="font-semibold text-lime-300">
                      ${getCourtPrice("20:00", selectedDate, prices).toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clases 09–13 */}
              <div className="px-5 pt-3 pb-2 border-t border-white/5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-2">
                  Clases con profesor · 09 a 13 hs
                </p>
                <div className="flex flex-wrap gap-2">
                  {CLASS_HOURS.map((hour) => {
                    const price = getClassPrice(prices);
                    const isSelected =
                      selectedSlot &&
                      selectedSlot.courtId === court.id &&
                      selectedSlot.hour === hour &&
                      selectedSlot.type === "class";
                    const slotState = getSlotState(court.id, hour);

                    return (
                      <button
                        key={hour}
                        onClick={() => handleSelectSlot(court, hour, "class")}
                        disabled={slotState.taken}
                        title={slotState.block?.reason || (slotState.reserved ? "Horario reservado" : "")}
                        className={`group flex items-center justify-between gap-3 px-4 py-2 rounded-2xl border text-xs min-w-[120px] transition-all ${
                          slotState.taken
                            ? "cursor-not-allowed border-orange-300/20 bg-orange-400/10 text-orange-100/70"
                            : isSelected
                              ? "bg-lime-300 text-black border-lime-300 shadow-lg shadow-lime-500/30"
                              : "bg-black/40 border-white/15 text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="font-medium">{hour} hs</span>
                        <span
                          className={`text-[11px] font-semibold ${
                            slotState.taken
                              ? "text-orange-100/80"
                              : isSelected
                                ? "text-black/80"
                                : "text-lime-300 group-hover:text-lime-200"
                          }`}
                        >
                          {slotState.block ? slotState.block.reason : slotState.reserved ? "Reservado" : `$${price.toLocaleString("es-AR")}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Turnos de pádel 13–22 */}
              <div className="px-5 pt-3 pb-4 border-t border-white/5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-2">
                  Turnos de pádel · 13 a 22 hs
                </p>
                <div className="flex flex-wrap gap-2">
                  {COURT_HOURS.map((hour) => {
                    const price = getCourtPrice(hour, selectedDate, prices);
                    const isSelected =
                      selectedSlot &&
                      selectedSlot.courtId === court.id &&
                      selectedSlot.hour === hour &&
                      selectedSlot.type === "court";
                    const slotState = getSlotState(court.id, hour);

                    return (
                      <button
                        key={hour}
                        onClick={() => handleSelectSlot(court, hour, "court")}
                        disabled={slotState.taken}
                        title={slotState.block?.reason || (slotState.reserved ? "Horario reservado" : "")}
                        className={`group flex items-center justify-between gap-3 px-4 py-2 rounded-2xl border text-xs min-w-[120px] transition-all ${
                          slotState.taken
                            ? "cursor-not-allowed border-orange-300/20 bg-orange-400/10 text-orange-100/70"
                            : isSelected
                              ? "bg-lime-300 text-black border-lime-300 shadow-lg shadow-lime-500/30"
                              : "bg-black/40 border-white/15 text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="font-medium">{hour} hs</span>
                        <span
                          className={`text-[11px] font-semibold ${
                            slotState.taken
                              ? "text-orange-100/80"
                              : isSelected
                                ? "text-black/80"
                                : "text-lime-300 group-hover:text-lime-200"
                          }`}
                        >
                          {slotState.block ? slotState.block.reason : slotState.reserved ? "Reservado" : `$${price.toLocaleString("es-AR")}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Columna derecha: resumen + pago */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-[#050814]/90 px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.9)]">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/40 mb-2">
              Tu reserva
            </p>

            {!selectedSlot ? (
              <div className="text-sm text-white/60">
                Todavía no seleccionaste un horario.
                <br />
                Elegí una clase o turno de pádel a la izquierda para ver el detalle acá.
              </div>
            ) : (
              <>
                <div className="mb-3 space-y-1">
                  <h3 className="text-base font-semibold">{selectedSlot.courtName}</h3>
                  <p className="text-xs text-white/60">
                    {formattedDate} · {selectedSlot.hour} hs
                  </p>
                  <p className="text-[11px] text-lime-300/90">
                    {selectedSlot.type === "class"
                      ? "Clase con profesor (09–13 hs)"
                      : "Turno de pádel (13–22 hs)"}
                  </p>
                </div>

                <div className="mb-3 rounded-2xl bg-black/50 border border-white/10 px-3 py-2 text-xs flex items-center justify-between">
                  <div className="text-white/60">
                    <p>Resumen</p>
                    <p className="text-[10px]">
                      1 turno · {selectedSlot.type === "class" ? "Clase" : "Cancha"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block text-[11px] text-white/50">Precio</span>
                    <span className="text-lg font-semibold text-lime-300">
                      ${selectedSlot.price.toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>

                {/* Opciones de pago */}
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-2">
                    Cómo querés pagar
                  </p>
                  <div className="space-y-2">
                    {PAYMENT_OPTIONS.map((opt) => {
                      const isActive = paymentOption === opt.id;

                      let amountLabel = "";
                      if (selectedSlot) {
                        if (opt.id === "deposit") {
                          amountLabel = `$${depositAmount.toLocaleString("es-AR")} ahora`;
                        } else if (opt.id === "full") {
                          amountLabel = `$${totalAmount.toLocaleString("es-AR")} ahora`;
                        } else {
                          amountLabel = "Pagás al llegar al club";
                        }
                      }

                      return (
                        <button
                          key={opt.id}
                          onClick={() => setPaymentOption(opt.id)}
                          className={`w-full text-left px-3 py-2 rounded-2xl border text-xs transition-all ${
                            isActive
                              ? "bg-lime-300 text-black border-lime-300 shadow-lg shadow-lime-500/30"
                              : "bg-black/40 border-white/15 text-white hover:bg-white/10"
                          }`}
                          disabled={!selectedSlot}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-[13px]">{opt.label}</p>
                              <p className="text-[11px] text-white/60 mt-0.5">
                                {opt.subtitle}
                              </p>
                            </div>
                            <div className="text-right text-[11px]">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 border ${
                                  isActive
                                    ? "border-black/20 bg-black/10 text-black/80"
                                    : "border-white/20 bg-white/5 text-white/60"
                                }`}
                              >
                                {opt.badge}
                              </span>
                              {selectedSlot && (
                                <div className="mt-1 text-lime-300">{amountLabel}</div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Botón confirmar */}
                <button
                  onClick={handleConfirm}
                  disabled={!selectedSlot || !paymentOption}
                  className={`mt-4 w-full text-sm font-semibold rounded-full px-4 py-2 transition-all ${
                    !selectedSlot || !paymentOption
                      ? "bg-white/10 text-white/40 cursor-not-allowed"
                      : "bg-lime-300 text-black hover:bg-lime-200 shadow-lg shadow-lime-500/30"
                  }`}
                >
                  {paymentOption === "cash"
                    ? "Confirmar reserva y pagar en el club"
                    : "Continuar con Mercado Pago"}
                </button>

                {confirmationMsg && (
                  <p className="mt-3 text-[11px] text-white/60">{confirmationMsg}</p>
                )}
              </>
            )}
          </div>

          <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 p-4 text-[11px] text-lime-50/85">
            <p className="font-semibold mb-1 text-white">Reserva segura</p>
            <p>El turno queda guardado en tu cuenta y el club lo visualiza al instante en su panel de gestión.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

import React, { useMemo, useState } from "react";

import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import { useSchedule, sameSlot } from "../hooks/useSchedule.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { COURTS, CLASS_HOURS, COURT_HOURS, COURT_DAY_END, DURATION_OPTIONS, PAYMENT_OPTIONS } from "../data/bookingConfig.js";
import { getClassPrice, getCourtPrice, getCourtPriceForDuration } from "../utils/pricing.js";
import { loadTeachers } from "../utils/teachersStorage.js";
import { useToast } from "../components/ToastProvider.jsx";

function minutesFromHour(hour = "00:00") {
  const [hh = "0", mm = "0"] = String(hour).split(":");
  return Number(hh) * 60 + Number(mm);
}

function addMinutesToHour(hour, minutes) {
  const total = minutesFromHour(hour) + Number(minutes || 0);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(Number(minutes || 0) / 60);
  const rest = Number(minutes || 0) % 60;
  if (!rest) return `${hours} h`;
  return `${hours}:${String(rest).padStart(2, "0")} h`;
}

export default function Booking() {
  const { user, openLogin } = useAuth();
  const { bookings, addBooking, setSelectedBooking } = useBooking();
  const { notify } = useToast();
  const { getBlock, isBlocked } = useSchedule();
  const { prices } = usePricing();
  const activeTeachers = useMemo(() => loadTeachers(prices.classPrice).filter((teacher) => teacher.status === "activo"), [prices.classPrice]);
  const primaryTeacher = activeTeachers[0] || null;
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDuration, setSelectedDuration] = useState(90);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [paymentOption, setPaymentOption] = useState(null);
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(`${selectedDate}T00:00:00`);
      return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  function courtHoursForDuration(hour, durationMinutes = selectedDuration) {
    const start = minutesFromHour(hour);
    const end = start + Number(durationMinutes || 60);
    return COURT_HOURS.filter((slotHour) => {
      const slotStart = minutesFromHour(slotHour);
      return slotStart >= start && slotStart < end;
    });
  }

  function isPastCourtEnd(hour, durationMinutes = selectedDuration) {
    return minutesFromHour(hour) + Number(durationMinutes || 60) > minutesFromHour(COURT_DAY_END);
  }

  function getSlotState(courtId, hour, type = "court", durationMinutes = selectedDuration) {
    if (type === "court" && isPastCourtEnd(hour, durationMinutes)) {
      return { block: { reason: "Fuera de horario" }, reserved: null, taken: true };
    }

    const hoursToCheck = type === "court" ? courtHoursForDuration(hour, durationMinutes) : [hour];
    const block = hoursToCheck.map((slotHour) => getBlock(selectedDate, courtId, slotHour)).find(Boolean);
    const reserved = bookings.find((booking) => hoursToCheck.some((slotHour) => sameSlot(booking, selectedDate, courtId, slotHour)));
    return { block, reserved, taken: Boolean(block || reserved) };
  }

  function isSlotTaken(courtId, hour, type = "court", durationMinutes = selectedDuration) {
    if (type === "court" && isPastCourtEnd(hour, durationMinutes)) return true;
    const hoursToCheck = type === "court" ? courtHoursForDuration(hour, durationMinutes) : [hour];
    return hoursToCheck.some((slotHour) => isBlocked(selectedDate, courtId, slotHour) || bookings.some((booking) => sameSlot(booking, selectedDate, courtId, slotHour)));
  }

  const handleSelectSlot = (court, hour, type) => {
    const durationMinutes = type === "class" ? 60 : selectedDuration;
    if (isSlotTaken(court.id, hour, type, durationMinutes)) return;

    const price = type === "class"
      ? getClassPrice(prices)
      : getCourtPriceForDuration(hour, selectedDate, durationMinutes, prices);

    setSelectedSlot({
      courtId: court.id,
      courtName: court.name,
      hour,
      time: hour,
      endTime: addMinutesToHour(hour, durationMinutes),
      durationMinutes,
      price,
      type,
      teacherId: type === "class" ? primaryTeacher?.id : null,
      teacherName: type === "class" ? primaryTeacher?.name : "",
      description: type === "class" ? "Clase con profesor" : `Turno de pádel de ${formatDuration(durationMinutes)}`,
    });
    setConfirmationMsg("");
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !paymentOption || isSubmitting) return;
    if (!user) {
      openLogin();
      setConfirmationMsg("Ingresá para confirmar la reserva y guardarla en tu cuenta.");
      notify({ type: "info", title: "Ingresá para reservar", message: "Después de iniciar sesión volvés al flujo con el horario seleccionado." });
      return;
    }

    if (isSlotTaken(selectedSlot.courtId, selectedSlot.hour, selectedSlot.type, selectedSlot.durationMinutes)) {
      setSelectedSlot(null);
      setPaymentOption(null);
      setConfirmationMsg("Ese horario ya no está disponible. Elegí otro turno para continuar.");
      notify({ type: "warning", title: "Horario ocupado", message: "Ese turno acaba de dejar de estar disponible." });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...selectedSlot,
        paymentOption,
        date: selectedDate,
        createdAt: new Date().toISOString(),
        userEmail: user.email,
        playerName: user.name,
        paymentMethod: paymentOption === "cash" ? "Paga en el club" : "Pago coordinado con el club",
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
        message = `Reserva guardada en tu cuenta. Se registró la seña de $${deposit.toLocaleString("es-AR")}.`;
      } else if (paymentOption === "full") {
        message = "Reserva guardada en tu cuenta. El turno quedó registrado con pago total.";
      } else {
        message = "Reserva guardada como 'paga en el club'. El administrador la verá como pendiente hasta registrar el pago.";
      }

      setConfirmationMsg(message);
      notify({ type: "success", title: "Reserva guardada", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const depositAmount = useMemo(() => selectedSlot ? Math.round(selectedSlot.price * 0.3) : 0, [selectedSlot]);
  const totalAmount = selectedSlot?.price || 0;

  return (
    <main className="main-container pt-24 text-white">
      <header className="mb-5 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">Reservas - Paso 2</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Reservar turno</h1>
          <p className="mt-1 max-w-xl text-sm text-white/70">Elegí día, cancha o clase, seleccioná la forma de pago y confirmá tu turno en pocos pasos.</p>
        </div>

        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">Fecha del turno</p>
          <div className="mt-1 flex items-center justify-end gap-3">
            <span className="text-sm font-medium">{formattedDate}</span>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);
                setPaymentOption(null);
                setConfirmationMsg("");
              }}
              className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lime-300/60"
            />
          </div>
          <p className="mt-1 text-[11px] text-white/55">Podés cambiarla desde acá sin volver al paso 1.</p>
        </div>
      </header>

      <section className="mb-5 rounded-3xl border border-lime-300/20 bg-lime-300/10 p-4 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-lime-100">Duración del partido</p>
            <h2 className="mt-1 text-xl font-black text-white">Reserva el tiempo que necesita tu grupo</h2>
            <p className="mt-1 text-sm text-slate-200">Ideal para partidos de 4 o más jugadores: 1:30, 2 hs o 2:30 hs.</p>
          </div>
          <div className="grid grid-cols-4 gap-2 md:min-w-[360px]">
            {DURATION_OPTIONS.map((option) => {
              const active = selectedDuration === option.minutes;
              return (
                <button
                  key={option.minutes}
                  onClick={() => {
                    setSelectedDuration(option.minutes);
                    if (selectedSlot?.type === "court") {
                      setSelectedSlot(null);
                      setPaymentOption(null);
                    }
                    setConfirmationMsg("");
                  }}
                  className={`rounded-2xl border px-2 py-2 text-xs font-black transition ${
                    active ? "border-lime-300 bg-lime-300 text-black shadow-lg shadow-lime-500/20" : "border-white/10 bg-black/35 text-white hover:border-lime-300/35"
                  }`}
                >
                  {option.shortLabel}
                  {option.recommended && <span className={`mt-1 block text-[9px] ${active ? "text-black/65" : "text-lime-100"}`}>usual</span>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] lg:gap-8">
        <div className="mobile-snap-row wide lg:block lg:space-y-5">
          {COURTS.map((court) => (
            <article key={court.id} className="overflow-hidden rounded-3xl border border-slate-800/90 bg-[#050814]/80 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
              <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-white/5 via-white/0 to-transparent px-5 pb-3 pt-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-lime-300/90">Cancha / Clase</p>
                  <h2 className="mt-1 text-sm font-semibold md:text-base">{court.name}</h2>
                  <p className="mt-1 text-[11px] text-white/60">{court.description}</p>
                  <p className="mt-1 text-[11px] text-lime-300/80">{court.tag}</p>
                  <p className="mt-1 text-[11px] text-white/45">Profes activos: {activeTeachers.map((t) => t.nickname || t.name).slice(0, 3).join(" - ")}</p>
                </div>

                <div className="hidden space-y-1 text-right text-[11px] text-white/60 sm:block">
                  <PriceLine label="Clases 09-13" value={getClassPrice(prices)} />
                  <PriceLine label="Padel 13-19" value={getCourtPrice("15:00", selectedDate, prices)} />
                  <PriceLine label="Noche desde 19" value={getCourtPrice("20:00", selectedDate, prices)} />
                </div>
              </div>

              <div className="border-t border-white/5 px-5 pb-2 pt-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/45">Clases con profesor - 09 a 13 hs</p>
                <div className="flex flex-wrap gap-2">
                  {CLASS_HOURS.map((hour) => {
                    const price = getClassPrice(prices);
                    const isSelected = selectedSlot?.courtId === court.id && selectedSlot.hour === hour && selectedSlot.type === "class";
                    const slotState = getSlotState(court.id, hour, "class", 60);
                    return (
                      <SlotChoice
                        key={hour}
                        disabled={slotState.taken}
                        selected={isSelected}
                        title={slotState.block?.reason || (slotState.reserved ? "Horario reservado" : "")}
                        onClick={() => handleSelectSlot(court, hour, "class")}
                        main={`${hour} hs`}
                        side={slotState.block ? slotState.block.reason : slotState.reserved ? "Reservado" : `$${price.toLocaleString("es-AR")}`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/5 px-5 pb-4 pt-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/55">Turnos de pádel - elegí {formatDuration(selectedDuration)}</p>
                <div className="flex flex-wrap gap-2">
                  {COURT_HOURS.map((hour) => {
                    const price = getCourtPriceForDuration(hour, selectedDate, selectedDuration, prices);
                    const endTime = addMinutesToHour(hour, selectedDuration);
                    const isSelected = selectedSlot?.courtId === court.id && selectedSlot.hour === hour && selectedSlot.type === "court";
                    const slotState = getSlotState(court.id, hour, "court", selectedDuration);
                    return (
                      <SlotChoice
                        key={hour}
                        disabled={slotState.taken}
                        selected={isSelected}
                        title={slotState.block?.reason || (slotState.reserved ? "Horario reservado" : `${hour} a ${endTime}`)}
                        onClick={() => handleSelectSlot(court, hour, "court")}
                        main={`${hour} - ${endTime}`}
                        side={slotState.block ? slotState.block.reason : slotState.reserved ? "Reservado" : `$${price.toLocaleString("es-AR")}`}
                      />
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="mobile-scroll-hint lg:hidden">Desliza para cambiar de cancha</p>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-[#050814]/90 px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.9)]">
            <p className="mb-2 text-[11px] uppercase tracking-[0.25em] text-white/40">Tu reserva</p>

            {!selectedSlot ? (
              <div className="text-sm text-white/70">Todavía no seleccionaste un horario.<br />Elegí una clase o turno de pádel a la izquierda para ver el detalle acá.</div>
            ) : (
              <>
                <div className="mb-3 space-y-1">
                  <h3 className="text-base font-semibold">{selectedSlot.courtName}</h3>
                  <p className="text-xs text-white/60">{formattedDate} - {selectedSlot.hour} a {selectedSlot.endTime}</p>
                  <p className="text-[11px] text-lime-300/90">
                    {selectedSlot.type === "class" ? "Clase con profesor" : `Turno de pádel - ${formatDuration(selectedSlot.durationMinutes)}`}
                  </p>
                </div>

                <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs">
                  <div className="text-white/60">
                    <p>Resumen</p>
                    <p className="text-[10px]">1 reserva - {selectedSlot.type === "class" ? "Clase" : formatDuration(selectedSlot.durationMinutes)}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-[11px] text-white/50">Precio</span>
                    <span className="text-lg font-semibold text-lime-300">${selectedSlot.price.toLocaleString("es-AR")}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/55">Cómo querés pagar</p>
                  <div className="space-y-2">
                    {PAYMENT_OPTIONS.map((opt) => {
                      const isActive = paymentOption === opt.id;
                      let amountLabel = "";
                      if (opt.id === "deposit") amountLabel = `$${depositAmount.toLocaleString("es-AR")} ahora`;
                      if (opt.id === "full") amountLabel = `$${totalAmount.toLocaleString("es-AR")} ahora`;
                      if (opt.id === "cash") amountLabel = "Pagás al llegar al club";

                      return (
                        <button
                          key={opt.id}
                          onClick={() => setPaymentOption(opt.id)}
                          className={`w-full rounded-2xl border px-3 py-2 text-left text-xs transition-all ${
                            isActive ? "border-lime-300 bg-lime-300 text-black shadow-lg shadow-lime-500/30" : "border-white/15 bg-black/40 text-white hover:bg-white/10"
                          }`}
                          disabled={!selectedSlot}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[13px] font-semibold">{opt.label}</p>
                              <p className="mt-0.5 text-[11px] text-white/60">{opt.subtitle}</p>
                            </div>
                            <div className="text-right text-[11px]">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${isActive ? "border-black/20 bg-black/10 text-black/80" : "border-white/20 bg-white/5 text-white/60"}`}>{opt.badge}</span>
                              <div className="mt-1 text-lime-300">{amountLabel}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={!selectedSlot || !paymentOption || isSubmitting}
                  className={`tap-action mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    !selectedSlot || !paymentOption || isSubmitting ? "cursor-not-allowed bg-white/10 text-white/40" : "bg-lime-300 text-black shadow-lg shadow-lime-500/30 hover:bg-lime-200"
                  }`}
                >
                  {isSubmitting && <span className="mini-spinner mini-spinner-dark" aria-hidden="true" />}
                  {isSubmitting ? "Guardando reserva" : paymentOption === "cash" ? "Confirmar reserva y pagar en el club" : "Confirmar reserva"}
                </button>

                {confirmationMsg && <p className="mt-3 text-[11px] text-white/60">{confirmationMsg}</p>}
              </>
            )}
          </div>

          <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 p-4 text-[11px] text-lime-50/85">
            <p className="mb-1 font-semibold text-white">Reserva segura</p>
            <p>El turno queda guardado en tu cuenta y el club lo visualiza al instante en su panel de gestión.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function PriceLine({ label, value }) {
  return (
    <div>
      <span className="block uppercase tracking-[0.18em] text-white/40">{label}</span>
      <span className="font-semibold text-lime-300">${Number(value || 0).toLocaleString("es-AR")}</span>
    </div>
  );
}

function SlotChoice({ disabled, selected, title, onClick, main, side }) {
  const dotClass = disabled
    ? "bg-orange-300 shadow-[0_0_10px_rgba(253,186,116,.72)]"
    : selected
      ? "bg-black/70"
      : "bg-lime-300 shadow-[0_0_10px_rgba(190,242,100,.78)]";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`group flex min-w-[128px] items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-xs transition-all ${
        disabled
          ? "cursor-not-allowed border-orange-300/20 bg-orange-400/10 text-orange-100/70"
          : selected
            ? "border-lime-300 bg-lime-300 text-black shadow-lg shadow-lime-500/30"
            : "border-white/15 bg-black/40 text-white hover:bg-white/10"
      }`}
    >
      <span className="inline-flex items-center gap-2 font-medium"><span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />{main}</span>
      <span className={`text-[11px] font-semibold ${disabled ? "text-orange-100/80" : selected ? "text-black/80" : "text-lime-300 group-hover:text-lime-200"}`}>{side}</span>
    </button>
  );
}

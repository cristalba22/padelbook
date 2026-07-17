// src/pages/MyBookings.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBooking } from "../hooks/useBooking";
import { useAuth } from "../hooks/useAuth.jsx";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { ROUTES } from "../constants/routes.js";
import { getUserTournamentRegistrations } from "../utils/tournamentsStorage.js";

const STATUS_LABELS = {
  confirmado: "confirmado",
  pendiente: "pendiente",
  cancelado: "cancelado",
};

const STATUS_COLORS = {
  confirmado: "bg-emerald-500/15 text-emerald-300 border-emerald-400/70",
  pendiente: "bg-amber-500/15 text-amber-200 border-amber-400/70",
  cancelado: "bg-rose-500/15 text-rose-200 border-rose-400/70",
};

// -------- helpers de fechas --------
function parseBookingDate(booking) {
  // Intentamos varios campos posibles para no romper nada
  if (booking.dateISO) return new Date(booking.dateISO);
  if (booking.dateObj instanceof Date) return booking.dateObj;

  if (typeof booking.date === "string") {
    const d = new Date(booking.date);
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback: hoy (para no tirar errores)
  return new Date();
}

function formatShortDate(date) {
  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

// -------- reserva guardada en versiones anteriores --------
function loadLastBooking() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem("padel_last_booking");
    if (!raw) return [];

    const data = JSON.parse(raw);
    if (!data || !data.date || !data.hour) return [];

    const dateISO = `${data.date}T00:00:00`;

    return [
      {
        id: data.id || "last-booking",
        status: "pendiente",
        date: data.date,
        dateISO,
        hora: data.hour,
        time: data.hour,
        courtId: data.courtId,
        courtName:
          data.courtName ||
          data.court ||
          "Cancha / clase",
        price: data.price,
        monto: data.price,
        paymentMethod:
          data.paymentOption === "cash"
            ? "Paga en el club"
            : "Pago coordinado",
        description:
          data.type === "class"
            ? "Clase con profesor"
            : "Turno de pádel",
      },
    ];
  } catch {
    return [];
  }
}

export default function MyBookings() {
  const { user, openLogin } = useAuth();
  const { settings } = useClubSettings();
  const { prices } = usePricing();
  const { bookings = [], cancelBooking, markAsPaid } = useBooking();
  const [filter, setFilter] = useState("upcoming"); // upcoming | pending | history | cancelled

  const today = new Date();

  const effectiveBookings = useMemo(() => {
    if (!user?.email) return [];
    if (bookings && bookings.length > 0) {
      return bookings.filter((b) => !b.userEmail || b.userEmail === user.email);
    }
    return loadLastBooking();
  }, [bookings, user?.email]);

  const tournamentAgendaItems = useMemo(() => {
    return getUserTournamentRegistrations(user, prices.tournamentPrice).map((registration) => ({
      id: `tournament-${registration.tournamentId}-${registration.id}`,
      source: "tournament",
      status: registration.status || "pendiente",
      date: registration.tournamentDate,
      time: registration.tournamentHour || "20:00",
      courtName: registration.tournamentName,
      price: registration.pricePerPlayer,
      paymentMethod: registration.paymentStatus === "pagado" ? "Inscripción pagada" : "Inscripción pendiente",
      description: `Torneo - ${registration.category || "Sin categoría"}`,
      partnerName: registration.partnerName,
    }));
  }, [user, prices.tournamentPrice]);

  const {
    upcoming,
    pending,
    cancelled,
    history,
    totalUpcoming,
    totalLast30,
    countLast30,
  } = useMemo(() => {
    const up = [];
    const pen = [];
    const canc = [];
    const hist = [];

    let total30 = 0;
    let count30 = 0;

    [...effectiveBookings, ...tournamentAgendaItems].forEach((b) => {
      const d = parseBookingDate(b);
      const status = (b.status || "").toLowerCase();

      // Últimos 30 días (para stats)
      const diffMs = today.getTime() - d.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 30 && status !== "cancelado") {
        const price = Number(b.price || b.monto || 0);
        if (!isNaN(price)) {
          total30 += price;
          count30 += 1;
        }
      }

      if (status === "cancelado") {
        canc.push({ ...b, dateObj: d });
      } else if (status === "pendiente") {
        pen.push({ ...b, dateObj: d });
      }

      // Consideramos "próximos" si la fecha es hoy o futura y no está cancelado
      if (d >= today && status !== "cancelado") {
        up.push({ ...b, dateObj: d });
      } else if (d < today) {
        hist.push({ ...b, dateObj: d });
      }
    });

    // Orden por fecha ascendente donde tenga sentido
    const byDateAsc = (a, b) => a.dateObj - b.dateObj;

    up.sort(byDateAsc);
    pen.sort(byDateAsc);
    hist.sort(byDateAsc);
    canc.sort(byDateAsc);

    const upcomingTotal = up.reduce((acc, b) => {
      const p = Number(b.price || b.monto || 0);
      return acc + (isNaN(p) ? 0 : p);
    }, 0);

    return {
      upcoming: up,
      pending: pen,
      cancelled: canc,
      history: hist,
      totalUpcoming: upcomingTotal,
      totalLast30: total30,
      countLast30: count30,
    };
  }, [effectiveBookings, tournamentAgendaItems, today]);

  let listToShow = upcoming;
  if (filter === "pending") listToShow = pending;
  if (filter === "history") listToShow = history;
  if (filter === "cancelled") listToShow = cancelled;

  const clubPhone = settings.whatsapp || "5493510000000";
  const bookingTimeLabel = (booking) => {
    const start = booking.hora || booking.time || "";
    return booking.endTime ? `${start} a ${booking.endTime}` : (start || "Horario a confirmar");
  };

  const handleWhatsApp = (booking) => {
    const text = encodeURIComponent(
      `Hola! Te escribo por mi reserva de pádel:\n\n` +
        `• Fecha: ${booking.fecha || booking.dateFormatted || booking.date || ""}\n` +
        `• Horario: ${bookingTimeLabel(booking)}\n` +
        `• Cancha / clase: ${
          booking.cancha || booking.court || booking.courtName || ""
        }\n\n` +
        `Quisiera hacer una consulta.`
    );
    window.open(`https://wa.me/${clubPhone}?text=${text}`, "_blank");
  };

  const handleCancel = (booking) => {
    if (!cancelBooking) return;
    const ok = window.confirm(
      `¿Seguro que querés cancelar el turno del ${
        booking.fecha || booking.dateFormatted || booking.date || ""
      } a las ${bookingTimeLabel(booking)}?`
    );
    if (ok) {
      cancelBooking(booking.id);
    }
  };

  const handlePayNow = (booking) => {
    if (markAsPaid && booking.id) {
      markAsPaid(booking.id);
      return;
    }
    alert(`Pago registrado para el turno ${booking.courtName || booking.cancha || booking.court || ""} – ${bookingTimeLabel(booking)}`);
  };

  if (!user) {
    return (
      <div className="main-container max-w-4xl text-white">
        <section className="rounded-[2rem] border border-lime-300/20 bg-[#0B1326]/80 p-8 text-center shadow-xl">
          <p className="page-kicker">Mis turnos</p>
          <h1 className="page-title mt-2">Ingresá para ver tu agenda</h1>
          <p className="page-subtitle mx-auto mt-3 max-w-2xl">
            Ingresá para ver tus reservas, pagos, cancelaciones, torneos inscriptos y contacto directo con el club.
          </p>
          <button type="button" onClick={openLogin} className="btn-primary mt-6">
            Ingresar
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="main-container max-w-6xl">
      {/* Encabezado */}
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="page-kicker">Mis turnos</p>
          <h1 className="page-title">Tu agenda de pádel</h1>
          <p className="page-subtitle max-w-xl">
            Acá ves todos tus turnos: próximos, pendientes, cancelados e
            historial. Podés pagar, cancelar o escribirle al club en un toque.
          </p>
        </div>

        {/* Mini resumen */}
        <div className="mobile-snap-row compact grid grid-cols-2 gap-3 text-xs md:text-sm">
          <div className="rounded-2xl border border-lime-400/40 bg-lime-400/10 px-4 py-3 shadow-lg shadow-lime-400/20">
            <p className="uppercase tracking-[0.18em] text-lime-200/80 text-[0.65rem]">
              Próximos
            </p>
            <p className="mt-1 text-lg font-semibold text-lime-100">
              {upcoming.length}
            </p>
            <p className="text-[0.7rem] text-lime-100/70">
              Turnos agendados 🗓️
            </p>
          </div>
          <div className="rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 shadow-lg shadow-sky-400/20">
            <p className="uppercase tracking-[0.18em] text-sky-200/80 text-[0.65rem]">
              Últimos 30 días
            </p>
            <p className="mt-1 text-lg font-semibold text-sky-100">
              ${totalLast30.toLocaleString("es-AR")}
            </p>
            <p className="text-[0.7rem] text-sky-100/70">
              En {countLast30} reservas
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Columna izquierda: filtros / resumen */}
        <aside className="w-full lg:w-64 lg:flex-shrink-0">
          <div className="rounded-3xl border border-zinc-700/70 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.8)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Filtros
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label={`Próximos (${upcoming.length})`}
                active={filter === "upcoming"}
                onClick={() => setFilter("upcoming")}
              />
              <FilterChip
                label={`Pendientes (${pending.length})`}
                active={filter === "pending"}
                onClick={() => setFilter("pending")}
              />
              <FilterChip
                label={`Historial (${history.length})`}
                active={filter === "history"}
                onClick={() => setFilter("history")}
              />
              <FilterChip
                label={`Cancelados (${cancelled.length})`}
                active={filter === "cancelled"}
                onClick={() => setFilter("cancelled")}
              />
            </div>

            <hr className="my-4 border-zinc-800" />

            <div className="space-y-3 text-xs text-zinc-400">
              <p className="font-semibold text-zinc-200">Atención del club</p>
              <p>{settings.clubName}</p>
              <p>{settings.address}</p>
              <p>Horario: {settings.openingHours}</p>
            </div>
          </div>
        </aside>

        {/* Columna derecha: lista de turnos */}
        <section className="flex-1">
          {listToShow.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950/95 p-8 text-center text-sm text-zinc-400 shadow-[0_18px_60px_rgba(0,0,0,0.8)]">
              <p className="mb-2 text-zinc-200 font-medium">
                No tenés turnos en esta categoría.
              </p>
              <p>Probá cambiando el filtro o reservando uno nuevo 😉</p>
            </div>
          ) : (
            <div className="space-y-4">
              {listToShow.map((booking) => {
                const dateObj =
                  booking.dateObj || parseBookingDate(booking);
                const status = (booking.status || "").toLowerCase();
                const statusClass =
                  STATUS_COLORS[status] || STATUS_COLORS.pendiente;

                return (
                  <article
                    key={
                      booking.id ||
                      `${booking.date}-${booking.time}-${booking.court}`
                    }
                    className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-950/95 via-zinc-900/95 to-zinc-950/95 p-4 md:p-5 shadow-[0_18px_70px_rgba(0,0,0,0.95)] hover:border-lime-400/40 hover:shadow-[0_18px_90px_rgba(190,254,41,0.25)] transition"
                  >
                    {/* Glow lateral */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-lime-400/10 via-transparent to-transparent" />

                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span className="uppercase tracking-[0.18em]">
                            {formatShortDate(dateObj)}
                          </span>
                          <span>•</span>
                          <span>
                            {bookingTimeLabel(booking)}
                          </span>
                        </div>
                        <h2 className="mt-1 text-base md:text-lg font-semibold text-zinc-50">
                          {booking.courtName ||
                            booking.cancha ||
                            booking.court ||
                            "Cancha / clase"}
                        </h2>
                        {booking.description && (
                          <p className="mt-1 text-xs text-zinc-400">
                            {booking.description}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${statusClass}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {STATUS_LABELS[status] || "pendiente"}
                          </span>

                          <span className="rounded-full bg-zinc-800/70 px-2.5 py-1 text-[0.7rem] text-zinc-300 border border-zinc-700">
                            Precio: $
                            {Number(
                              booking.price || booking.monto || 0
                            ).toLocaleString("es-AR")}
                          </span>
                          {booking.paymentMethod && (
                            <span className="rounded-full bg-zinc-900/80 px-2.5 py-1 text-[0.7rem] text-zinc-400 border border-zinc-800">
                              {booking.paymentMethod}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex flex-col items-stretch gap-2 text-xs md:text-[0.8rem] z-10">
                        {status === "pendiente" && booking.source !== "tournament" && (
                          <button
                            onClick={() => handlePayNow(booking)}
                            className="rounded-full bg-gradient-to-r from-lime-400 to-lime-300 px-4 py-2 font-semibold text-zinc-950 shadow-lg shadow-lime-400/40 hover:shadow-lime-400/60 transition"
                          >
                            Coordinar pago
                          </button>
                        )}

                        <button
                          onClick={() => handleWhatsApp(booking)}
                          className="rounded-full border border-emerald-400/60 bg-emerald-500/15 px-4 py-2 font-medium text-emerald-200 hover:bg-emerald-500/25 transition"
                        >
                          Escribir al club por WhatsApp
                        </button>

                        {booking.source === "tournament" && (
                          <Link
                            to={ROUTES.TOURNAMENTS}
                            className="rounded-full border border-lime-300/50 bg-lime-400/10 px-4 py-2 text-center font-medium text-lime-100 hover:bg-lime-400/20 transition"
                          >
                            Ver torneo
                          </Link>
                        )}

                        {status !== "cancelado" && booking.source !== "tournament" && cancelBooking && (
                          <button
                            onClick={() => handleCancel(booking)}
                            className="rounded-full border border-rose-500/70 bg-rose-500/10 px-4 py-2 font-medium text-rose-200 hover:bg-rose-500/20 transition"
                          >
                            Cancelar turno
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3.5 py-1.5 text-[0.75rem] font-medium border transition",
        active
          ? "bg-lime-400 text-zinc-900 border-lime-300 shadow-lg shadow-lime-400/40"
          : "bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:border-lime-300/60 hover:text-lime-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
}



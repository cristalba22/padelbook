import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../utils/apiClient.js";
import { addActivity } from "../utils/activityLog.js";
import { safeRead, safeWrite } from "../utils/storage.js";
import { useAuth } from "./useAuth.jsx";
import { bookingsOverlap } from "../utils/bookingDomain.js";
import { applyPayment, reversePayment } from "../utils/paymentDomain.js";

const BookingCtx = createContext(null);
const BOOKINGS_KEY = "padel_bookings";

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStatus(status) {
  return String(status || "pendiente").toLowerCase();
}

function readBookings() {
  return safeRead(BOOKINGS_KEY, []).map((booking) => ({ ...booking, status: normalizeStatus(booking.status) }));
}

export function BookingProvider({ children }) {
  const { user, apiOnline } = useAuth();
  const [bookings, setBookings] = useState(() => apiOnline ? [] : readBookings());
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    const sync = (event) => {
      if (!event || event.key === BOOKINGS_KEY) setBookings(readBookings());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("padel:bookings-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("padel:bookings-updated", sync);
    };
  }, []);

  useEffect(() => {
    if (!apiOnline) return;
    setBookings([]);
    if (!user) return;
    apiRequest("/bookings")
      .then(({ bookings: remoteBookings }) => {
        setBookings(remoteBookings.map((booking) => ({ ...booking, status: normalizeStatus(booking.status) })));
      })
      .catch(() => setBookings([]));
  }, [apiOnline, user?.id, user?.role]);

  function persist(next) {
    const normalized = next.map((booking) => ({ ...booking, status: normalizeStatus(booking.status) }));
    setBookings(normalized);
    safeWrite(BOOKINGS_KEY, normalized);
    window.dispatchEvent(new Event("padel:bookings-updated"));
  }

  async function addBooking(bookingData) {
    if (apiOnline && user) {
      try {
        const { booking } = await apiRequest("/bookings", {
          method: "POST",
          body: JSON.stringify(bookingData),
        });
        setBookings((current) => [...current.filter((item) => item.id !== booking.id), booking]);
        window.dispatchEvent(new Event("padel:bookings-updated"));
        return booking;
      } catch (error) {
        if (error.status === 409) return { ...(error.payload?.booking || bookingData), duplicated: true };
        throw error;
      }
    }

    const duplicated = bookings.find((b) => bookingsOverlap(b, bookingData));
    if (duplicated) return { ...duplicated, duplicated: true };

    const withId = {
      id: makeId(),
      status: "pendiente",
      paymentStatus: bookingData.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago",
      createdAt: new Date().toISOString(),
      ...bookingData,
    };
    persist([...bookings, withId]);
    addActivity({
      type: "booking_created",
      title: "Nueva reserva",
      detail: `${withId.playerName || withId.userName || "Jugador"} - ${withId.date} ${withId.time || withId.hour}${withId.endTime ? ` a ${withId.endTime}` : ""} - ${withId.courtName || withId.court || "Cancha"}`,
      actor: withId.playerName || withId.userName || "Jugador",
      bookingId: withId.id,
    });
    return withId;
  }

  async function updateBookingStatus(id, status, extra = {}) {
    const normalizedStatus = normalizeStatus(status);
    if (apiOnline && user?.role === "admin") {
      const { booking } = await apiRequest(`/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: normalizedStatus }),
      });
      setBookings((current) => current.map((item) => item.id === id ? booking : item));
      window.dispatchEvent(new Event("padel:bookings-updated"));
      return booking;
    }

    let updated = null;
    const next = bookings.map((b) => {
      if (b.id !== id) return b;
      updated = {
        ...b,
        status: normalizedStatus,
        updatedAt: new Date().toISOString(),
        ...(normalizedStatus === "cancelado" ? { cancelledAt: new Date().toISOString() } : {}),
        ...extra,
      };
      return updated;
    });
    persist(next);
    if (updated) {
      const titles = { confirmado: "Reserva confirmada", pendiente: "Reserva marcada pendiente", cancelado: "Reserva cancelada" };
      addActivity({
        type: `booking_${normalizedStatus}`,
        title: titles[normalizedStatus] || "Reserva actualizada",
        detail: `${updated.playerName || updated.userName || "Jugador"} - ${updated.date} ${updated.time || updated.hour}${updated.endTime ? ` a ${updated.endTime}` : ""} - ${updated.courtName || updated.court || "Cancha"}`,
        actor: extra.actor || "Club",
        bookingId: updated.id,
      });
    }
    return updated;
  }

  async function recordPayment(id, details) {
    if (user?.role !== "admin") throw new Error("Solo el club puede registrar pagos.");
    if (apiOnline) {
      const { booking } = await apiRequest(`/bookings/${id}/payments`, {
        method: "POST",
        body: JSON.stringify(details),
      });
      setBookings((current) => current.map((item) => item.id === id ? booking : item));
      window.dispatchEvent(new Event("padel:bookings-updated"));
      return booking;
    }
    const current = bookings.find((booking) => booking.id === id);
    if (!current) throw new Error("Reserva no encontrada.");
    const updated = applyPayment(current, { ...details, actor: user?.name || "Club" });
    const next = bookings.map((booking) => booking.id === id ? updated : booking);
    persist(next);
    addActivity({ type: "booking_payment_recorded", title: "Cobro registrado", detail: `${updated.playerName || "Jugador"} - $${details.amount}`, actor: user?.name || "Club", bookingId: id });
    return updated;
  }

  async function undoLastPayment(id, idempotencyKey) {
    if (user?.role !== "admin") throw new Error("Solo el club puede revertir cobros.");
    if (apiOnline) {
      const { booking } = await apiRequest(`/bookings/${id}/payments/reverse`, { method: "POST", body: JSON.stringify({ idempotencyKey }) });
      setBookings((current) => current.map((item) => item.id === id ? booking : item));
      window.dispatchEvent(new Event("padel:bookings-updated"));
      return booking;
    }
    const current = bookings.find((booking) => booking.id === id);
    if (!current) throw new Error("Reserva no encontrada.");
    const updated = reversePayment(current, user?.name || "Club");
    persist(bookings.map((booking) => booking.id === id ? updated : booking));
    addActivity({ type: "booking_payment_reversed", title: "Cobro revertido", detail: updated.playerName || "Jugador", actor: user?.name || "Club", bookingId: id });
    return updated;
  }

  async function cancelBooking(id) {
    if (apiOnline && user) {
      const { booking } = await apiRequest(`/bookings/${id}/cancel`, { method: "POST" });
      setBookings((current) => current.map((item) => item.id === id ? booking : item));
      window.dispatchEvent(new Event("padel:bookings-updated"));
      return booking;
    }
    return updateBookingStatus(id, "cancelado");
  }

  const value = useMemo(
    () => ({ bookings, selectedBooking, setSelectedBooking, addBooking, cancelBooking, updateBookingStatus, recordPayment, undoLastPayment }),
    [bookings, selectedBooking, apiOnline, user?.role]
  );

  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingCtx);
  if (!ctx) throw new Error("useBooking debe usarse dentro de <BookingProvider>");
  return ctx;
}

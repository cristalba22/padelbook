import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../utils/apiClient.js";
import { addActivity } from "../utils/activityLog.js";
import { safeRead, safeWrite } from "../utils/storage.js";
import { useAuth } from "./useAuth.jsx";

const BookingCtx = createContext(null);
const BOOKINGS_KEY = "padel_bookings";

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStatus(status) {
  return String(status || "pendiente").toLowerCase();
}

function minutesFromHour(hour = "00:00") {
  const [hh = "0", mm = "0"] = String(hour).split(":");
  return Number(hh) * 60 + Number(mm);
}

function overlapsBooking(a = {}, b = {}) {
  if (normalizeStatus(a.status) === "cancelado") return false;
  if (a.date !== b.date) return false;
  if (String(a.courtId) !== String(b.courtId)) return false;

  const aStart = minutesFromHour(a.time || a.hour);
  const aEnd = aStart + Number(a.durationMinutes || 60);
  const bStart = minutesFromHour(b.time || b.hour);
  const bEnd = bStart + Number(b.durationMinutes || 60);
  return aStart < bEnd && bStart < aEnd;
}

function readBookings() {
  return safeRead(BOOKINGS_KEY, []).map((booking) => ({ ...booking, status: normalizeStatus(booking.status) }));
}

export function BookingProvider({ children }) {
  const { user, apiOnline } = useAuth();
  const [bookings, setBookings] = useState(readBookings);
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
    if (!apiOnline || !user) return;
    apiRequest("/bookings")
      .then(({ bookings: remoteBookings }) => {
        setBookings(remoteBookings.map((booking) => ({ ...booking, status: normalizeStatus(booking.status) })));
      })
      .catch(() => {});
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

    const duplicated = bookings.find((b) => overlapsBooking(b, bookingData));
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
        paymentStatus: normalizedStatus === "confirmado" ? "pagado" : normalizedStatus === "pendiente" ? "pendiente_pago" : b.paymentStatus,
        updatedAt: new Date().toISOString(),
        ...(normalizedStatus === "confirmado" ? { paidAt: new Date().toISOString() } : {}),
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

  const cancelBooking = (id) => updateBookingStatus(id, "cancelado");
  const markAsPaid = (id) => updateBookingStatus(id, "confirmado", { paymentStatus: "pagado" });
  const markAsPending = (id) => updateBookingStatus(id, "pendiente", { paymentStatus: "pendiente_pago" });

  const value = useMemo(
    () => ({ bookings, selectedBooking, setSelectedBooking, addBooking, cancelBooking, markAsPaid, markAsPending, updateBookingStatus }),
    [bookings, selectedBooking, apiOnline, user?.role]
  );

  return <BookingCtx.Provider value={value}>{children}</BookingCtx.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingCtx);
  if (!ctx) throw new Error("useBooking debe usarse dentro de <BookingProvider>");
  return ctx;
}

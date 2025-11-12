// src/hooks/useBooking.jsx
import React, { createContext, useContext, useState } from "react";

const BookingCtx = createContext(null);

export function BookingProvider({ children }) {
  // todas las reservas hechas desde este front (mock)
  const [bookings, setBookings] = useState([]);
  // turno seleccionado en la pantalla de reservar
  const [selectedBooking, setSelectedBooking] = useState(null);

  // cuando el usuario confirma en el modal
  function addBooking(bookingData) {
    const withId = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now(),
      status: "pendiente",
      ...bookingData,
    };
    setBookings((prev) => [...prev, withId]);
    return withId;
  }

  // cancelar desde "mis turnos"
  function cancelBooking(id) {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelado" } : b))
    );
  }

  return (
    <BookingCtx.Provider
      value={{
        bookings,
        selectedBooking,
        setSelectedBooking,
        addBooking,
        cancelBooking,
      }}
    >
      {children}
    </BookingCtx.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingCtx);
  if (!ctx) {
    throw new Error("useBooking debe usarse dentro de <BookingProvider>");
  }
  return ctx;
}

import React, { createContext, useContext, useState } from "react";

const BookingContext = createContext(null);

export function BookingProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  // guarda una reserva pendiente en localStorage
  const savePendingBooking = (bookingObj) => {
    const prev = JSON.parse(localStorage.getItem("pendingBookings") || "[]");
    prev.push({
      ...bookingObj,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("pendingBookings", JSON.stringify(prev));
  };

  // lee todas las reservas pendientes
  const getPendingBookings = () => {
    return JSON.parse(localStorage.getItem("pendingBookings") || "[]");
  };

  // elimina una reserva por índice
  const removeBooking = (idxToRemove) => {
    const prev = JSON.parse(localStorage.getItem("pendingBookings") || "[]");
    const updated = prev.filter((_, i) => i !== idxToRemove);
    localStorage.setItem("pendingBookings", JSON.stringify(updated));
    return updated;
  };

  return (
    <BookingContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        selectedCourt,
        setSelectedCourt,
        selectedTime,
        setSelectedTime,
        savePendingBooking,
        getPendingBookings,
        removeBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    throw new Error(
      "useBooking debe usarse dentro de <BookingProvider>"
    );
  }
  return ctx;
}

import React, { createContext, useContext, useState } from "react";

const BookingCtx = createContext(null);

export function BookingProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selection, setSelection] = useState(null);
  // selection = { courtId, courtName, time, price }

  function confirmSlot(slotInfo) {
    setSelection(slotInfo);
  }

  function clearBooking() {
    setSelection(null);
  }

  return (
    <BookingCtx.Provider
      value={{
        selectedDate,
        setSelectedDate,
        selection,
        confirmSlot,
        clearBooking,
      }}
    >
      {children}
    </BookingCtx.Provider>
  );
}

export function useBooking() {
  return useContext(BookingCtx);
}

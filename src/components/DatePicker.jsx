import React from "react";
import { useBooking } from "../hooks/useBooking.jsx";

export default function DatePicker() {
  const { selectedDate, setSelectedDate } = useBooking();

  return (
    <div className="flex flex-col">
      <label className="text-xs text-neutral-400 mb-1">Fecha</label>
      <input
        type="date"
        className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
      />
    </div>
  );
}

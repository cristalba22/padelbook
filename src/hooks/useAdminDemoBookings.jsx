import { useCallback, useEffect, useState } from "react";
import { bookings as initialBookings } from "../data/adminMock.js";
import { safeRead, safeWrite } from "../utils/storage.js";

const today = new Date();
const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const storageKey = `padel_admin_demo_bookings_${dateKey}`;
const updateEvent = "padel:admin-demo-bookings-updated";

function readDemoBookings() {
  return safeRead(storageKey, initialBookings);
}

export function useAdminDemoBookings() {
  const [demoBookings, setDemoBookings] = useState(readDemoBookings);

  useEffect(() => {
    const sync = (event) => {
      if (!event || event.key === storageKey) setDemoBookings(readDemoBookings());
    };
    window.addEventListener("storage", sync);
    window.addEventListener(updateEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(updateEvent, sync);
    };
  }, []);

  const updateDemoBookingStatus = useCallback((id, status) => {
    const next = readDemoBookings().map((booking) => booking.id === id ? { ...booking, status } : booking);
    safeWrite(storageKey, next);
    setDemoBookings(next);
    window.dispatchEvent(new Event(updateEvent));
  }, []);

  return { demoBookings, updateDemoBookingStatus };
}

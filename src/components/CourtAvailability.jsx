import React, { useMemo } from "react";
import { courts } from "../data/courts.js";
import { mockSlots } from "../data/slots.js";
import SlotButton from "./SlotButton.jsx";
import { useBooking } from "../hooks/useBooking.jsx";

export default function CourtAvailability() {
  const { confirmSlot } = useBooking();

  const slotsByCourt = useMemo(() => {
    const map = {};
    for (const c of courts) {
      map[c.id] = [];
    }
    for (const s of mockSlots) {
      map[s.courtId].push(s);
    }
    return map;
  }, []);

  return (
    <div className="grid md:grid-cols-3 gap-6 mt-6">
      {courts.map((court) => (
        <div
          key={court.id}
          className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 shadow-[0_0_30px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white font-semibold text-sm leading-tight">
                {court.name}
              </div>
              <div className="text-[11px] text-neutral-500 leading-tight">
                Desde ${court.price}
              </div>
            </div>

            <div className="text-[10px] text-neutral-400 bg-neutral-800 rounded-md px-2 py-1 border border-neutral-700">
              Tech / LED / Blindex
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {slotsByCourt[court.id].map((slot, idx) => (
              <SlotButton
                key={idx}
                slot={slot}
                courtName={court.name}
                onSelect={confirmSlot}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

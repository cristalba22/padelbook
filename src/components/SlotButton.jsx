import React from "react";

export default function SlotButton({ slot, courtName, onSelect }) {
  const { time, isAvailable, price } = slot;

  if (!isAvailable) {
    return (
      <button
        disabled
        className="text-xs w-full rounded-md px-2 py-2 bg-neutral-800/40 text-neutral-600 border border-neutral-700 cursor-not-allowed line-through"
      >
        {time} hs
      </button>
    );
  }

  return (
    <button
      onClick={() =>
        onSelect({
          courtId: slot.courtId,
          courtName,
          time,
          price
        })
      }
      className="text-xs w-full rounded-md px-2 py-2 bg-neutral-800 text-white border border-neutral-600 hover:border-lime-400 hover:text-lime-400 transition"
    >
      <div className="flex items-center justify-between">
        <span>{time} hs</span>
        <span className="text-[10px] text-lime-400 font-semibold">
          ${price}
        </span>
      </div>
    </button>
  );
}

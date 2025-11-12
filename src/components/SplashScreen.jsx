import React, { useEffect, useState } from "react";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Mostrar por 2 segundos y luego desaparecer
    const timer = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="text-center">
        <div className="p-6 rounded-xl bg-neutral-900 border border-lime-400/10 shadow-[0_0_20px_rgba(163,230,53,0.2)]">
          <div className="flex justify-center gap-2 mb-2">
            <div className="bg-lime-400 text-black font-bold rounded-md px-3 py-1">BK</div>
            <div className="bg-lime-400 text-black font-bold rounded-md px-3 py-1">PDL</div>
          </div>
          <h1 className="text-lime-400 font-semibold text-lg">Book Padel</h1>
          <p className="text-neutral-400 text-xs mb-3">Gestión de turnos</p>
          <div className="h-[3px] w-20 mx-auto bg-lime-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

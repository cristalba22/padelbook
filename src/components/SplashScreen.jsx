// src/pages/SplashScreen.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // Simula una carga de 1.5s y te manda al home
    const t = setTimeout(() => {
      navigate(ROUTES.HOME, { replace: true });
    }, 1500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-400/10 border border-lime-400/40 shadow-[0_0_30px_rgba(190,254,41,0.4)]">
          <span className="inline-block h-2 w-2 rounded-full bg-lime-400 animate-pulse"></span>
          <span className="text-xs tracking-[0.25em] text-lime-200 uppercase">
            Book Padel
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-2">
          Cargando tu club...
        </h1>
        <p className="text-sm text-zinc-400">
          Calendario, torneos y comunidad en un solo lugar.
        </p>

        <div className="mt-8 flex justify-center">
          <div className="h-1 w-40 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full w-1/2 bg-lime-400 animate-[ping_1s_ease-in-out_infinite]"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

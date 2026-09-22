import React from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";

export default function NotFound() {
  return (
    <main className="main-container interior-page grid min-h-[70vh] place-items-center text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.75)]">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-lime-300">Ruta no encontrada</p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] md:text-5xl">Esta pantalla no existe.</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-400">
          Revisá la dirección o volvé al inicio para buscar un turno.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to={ROUTES.HOME} className="btn-primary">Volver al inicio</Link>
          <Link to={ROUTES.BOOKING} className="btn-outline">Reservar turno</Link>
        </div>
      </section>
    </main>
  );
}

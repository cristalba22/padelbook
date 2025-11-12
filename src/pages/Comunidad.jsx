// src/pages/Comunidad.jsx
import React from "react";

export default function Comunidad() {
  return (
    <main className="min-h-screen pt-20 pb-16 bg-[#020304] text-white">
      <div className="max-w-5xl mx-auto px-4 lg:px-0">
        <h2 className="text-2xl font-semibold mb-2">Comunidad de jugadores</h2>
        <p className="text-slate-300 text-sm mb-6">
          Unite al grupo de tu nivel (7ma a 2da). ¿Te falta un jugador? ¿Te
          querés sumar a un partido armado hoy? Acá vas a tener acceso a los
          grupos de WhatsApp por categoría.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {["7ma", "6ta", "5ta", "4ta", "3ra", "2da"].map((cat) => (
            <div
              key={cat}
              className="bg-[#0E1010] border border-slate-900 rounded-xl p-5"
            >
              <p className="text-sm text-white mb-2">{cat} categoría</p>
              <p className="text-slate-400 text-xs mb-3">
                Jugadores de nivel intermedio a avanzado. Ideal para partidos
                competitivos y amistosos.
              </p>
              <a
                href="https://wa.me/5493517662122"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-lime-200 hover:text-lime-100"
              >
                Unirme al grupo →
              </a>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

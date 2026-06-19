import React from "react";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";

export default function Footer() {
  const { settings } = useClubSettings();
  const mapsQuery = encodeURIComponent(settings.mapsQuery || settings.address || settings.clubName);
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-lime-400 to-emerald-300 flex items-center justify-center text-[9px] font-extrabold text-black">
            PB
          </div>
          <span className="text-xs text-white/70">
            {settings.clubShortName} · Reservas, torneos y comunidad de pádel
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-white/50">
          <div className="text-right sm:text-left">
            <p className="text-[11px] font-semibold text-white/80">{settings.clubName}</p>
            <p className="text-[11px] text-white/60">{settings.address}</p>
            <a
              href={`https://www.google.com/maps?q=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
            >
              Ver en Google Maps
            </a>
          </div>

          <div className="hidden md:block w-40 h-24 rounded-xl overflow-hidden border border-white/10 shadow-[0_0_18px_rgba(0,0,0,0.7)]">
            <iframe
              title={`Mapa ${settings.clubName}`}
              src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}

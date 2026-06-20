import React from "react";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";

function cleanPhone(value = "") {
  return String(value).replace(/\D/g, "");
}

function instagramUrl(handle = "") {
  const clean = String(handle).replace(/^@/, "").trim();
  return clean ? `https://www.instagram.com/${clean}/` : "https://www.instagram.com/";
}

export default function Footer() {
  const { settings } = useClubSettings();
  const mapsQuery = encodeURIComponent(settings.mapsQuery || settings.address || settings.clubName);
  const phone = cleanPhone(settings.whatsapp);
  const whatsappText = encodeURIComponent(`Hola, quiero consultar por reservas en ${settings.clubName}.`);
  const whatsappUrl = phone ? `https://wa.me/${phone}?text=${whatsappText}` : "#";
  const instagram = settings.instagram || "padelbook.club";

  return (
    <footer className="border-t border-white/10 bg-[#020617] text-white">
      <div className="mx-auto grid max-w-[1360px] gap-5 px-5 py-8 lg:grid-cols-[1fr_420px] lg:items-stretch">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#071022] p-5 shadow-xl">
          <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-lime-300 to-emerald-300 text-xs font-black text-black shadow-[0_0_28px_rgba(61,247,168,0.35)]">
                PB
              </div>
              <div>
                <p className="text-sm font-black text-white">{settings.clubShortName}</p>
                <p className="text-xs text-slate-400">Reservas, torneos y comunidad de padel</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Club</p>
                <h2 className="mt-2 text-xl font-black text-white">{settings.clubName}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">{settings.address}</p>
                <p className="mt-2 text-xs font-bold text-lime-100">Horario: {settings.openingHours}</p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Contactanos</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="btn-primary px-4 py-2 text-xs" href={whatsappUrl} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                  <a className="btn-outline px-4 py-2 text-xs" href={instagramUrl(instagram)} target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                  <a className="btn-outline px-4 py-2 text-xs" href={`https://www.google.com/maps?q=${mapsQuery}`} target="_blank" rel="noreferrer">
                    Como llegar
                  </a>
                </div>
                <p className="mt-3 text-xs text-slate-500">@{instagram.replace(/^@/, "")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-lime-300/20 bg-lime-300/10 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-lime-100">Ubicacion</p>
              <p className="text-sm font-bold text-white">{settings.clubName}</p>
            </div>
            <a
              className="rounded-full border border-lime-300/30 px-3 py-1 text-xs font-bold text-lime-100 transition hover:bg-lime-300/10"
              href={`https://www.google.com/maps?q=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver mapa
            </a>
          </div>
          <div className="h-56 bg-[#050814] sm:h-64 lg:h-full lg:min-h-[230px]">
            <iframe
              title={`Mapa ${settings.clubName}`}
              src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0, filter: "saturate(0.9) contrast(1.05)" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      </div>
    </footer>
  );
}

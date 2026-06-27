import { safeRead, safeWrite } from "./storage.js";

export const CLUB_SETTINGS_KEY = "padel_club_settings";

export const DEFAULT_CLUB_SETTINGS = Object.freeze({
  clubName: import.meta.env.VITE_CLUB_NAME || "Arena Norte Padel Club",
  clubShortName: import.meta.env.VITE_CLUB_SHORT_NAME || "PadelBook",
  address: import.meta.env.VITE_CLUB_ADDRESS || "Edmundo Mariotte 5308 - Córdoba Capital",
  mapsQuery: import.meta.env.VITE_CLUB_MAPS_QUERY || "Edmundo Mariotte 5308, Córdoba, Argentina",
  whatsapp: import.meta.env.VITE_CLUB_WHATSAPP || "5493510000000",
  instagram: import.meta.env.VITE_CLUB_INSTAGRAM || "padelbook.club",
  openingHours: import.meta.env.VITE_CLUB_OPENING_HOURS || "09:00 a 22:00",
  homeHeadline: import.meta.env.VITE_HOME_HEADLINE || "Tu próximo partido empieza antes de llegar a la cancha.",
  homeSubtitle:
    import.meta.env.VITE_HOME_SUBTITLE ||
    "Reservá, pagá seña, consultá tus turnos, buscá jugadores por categoría y entrá a torneos desde una experiencia simple, rápida y pensada para jugadores de pádel.",
  promoText: import.meta.env.VITE_HOME_PROMO_TEXT || "9ª reserva bonificada",
  clubStatus: import.meta.env.VITE_CLUB_STATUS || "Club abierto - reservas online",
});

function normalizeSettings(input = {}) {
  return {
    clubName: String(input.clubName || DEFAULT_CLUB_SETTINGS.clubName),
    clubShortName: String(input.clubShortName || DEFAULT_CLUB_SETTINGS.clubShortName),
    address: String(input.address || DEFAULT_CLUB_SETTINGS.address),
    mapsQuery: String(input.mapsQuery || input.address || DEFAULT_CLUB_SETTINGS.mapsQuery),
    whatsapp: String(input.whatsapp || DEFAULT_CLUB_SETTINGS.whatsapp).replace(/\D/g, ""),
    instagram: String(input.instagram || DEFAULT_CLUB_SETTINGS.instagram).replace(/^@/, "").trim(),
    openingHours: String(input.openingHours || DEFAULT_CLUB_SETTINGS.openingHours),
    homeHeadline: String(input.homeHeadline || DEFAULT_CLUB_SETTINGS.homeHeadline),
    homeSubtitle: String(input.homeSubtitle || DEFAULT_CLUB_SETTINGS.homeSubtitle),
    promoText: String(input.promoText || DEFAULT_CLUB_SETTINGS.promoText),
    clubStatus: String(input.clubStatus || DEFAULT_CLUB_SETTINGS.clubStatus),
  };
}

export function loadClubSettings() {
  return normalizeSettings(safeRead(CLUB_SETTINGS_KEY, DEFAULT_CLUB_SETTINGS));
}

export function saveClubSettings(settings) {
  const cleaned = normalizeSettings(settings);
  safeWrite(CLUB_SETTINGS_KEY, cleaned);
  return cleaned;
}

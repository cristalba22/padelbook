import { safeRead, safeWrite } from "./storage.js";

export const CLUB_SETTINGS_KEY = "padel_club_settings";

const LEGACY_COPY = {
  clubName: "Arena Norte Padel Club",
  address: "Edmundo Mariotte 5308 - Córdoba Capital",
  mapsQuery: "Edmundo Mariotte 5308, Córdoba, Argentina",
  whatsapp: "5493510000000",
  instagram: "padelbook.club",
  homeHeadline: "Tu próximo partido empieza antes de llegar a la cancha.",
  homeSubtitle: "Reservá cancha, coordiná la seña con el club, consultá tus turnos y sumate a torneos desde una experiencia simple y rápida.",
};

const replaceLegacy = (value, legacy, fallback) => value === legacy ? fallback : value;

export const DEFAULT_CLUB_SETTINGS = Object.freeze({
  clubName: import.meta.env.VITE_CLUB_NAME || "PadelBook",
  clubShortName: import.meta.env.VITE_CLUB_SHORT_NAME || "PadelBook",
  address: import.meta.env.VITE_CLUB_ADDRESS || "",
  mapsQuery: import.meta.env.VITE_CLUB_MAPS_QUERY || "",
  whatsapp: import.meta.env.VITE_CLUB_WHATSAPP || "",
  instagram: import.meta.env.VITE_CLUB_INSTAGRAM || "",
  openingHours: import.meta.env.VITE_CLUB_OPENING_HOURS || "09:00 a 22:00",
  homeHeadline: import.meta.env.VITE_HOME_HEADLINE || "Nos vemos en la cancha.",
  homeSubtitle:
    import.meta.env.VITE_HOME_SUBTITLE ||
    "Elegí cancha y horario. El club recibe la reserva y podés seguir su estado desde tu cuenta.",
  promoText: import.meta.env.VITE_HOME_PROMO_TEXT || "",
  clubStatus: import.meta.env.VITE_CLUB_STATUS || "Reservas online",
});

function normalizeSettings(input = {}) {
  return {
    clubName: replaceLegacy(String(input.clubName || DEFAULT_CLUB_SETTINGS.clubName), LEGACY_COPY.clubName, DEFAULT_CLUB_SETTINGS.clubName),
    clubShortName: String(input.clubShortName || DEFAULT_CLUB_SETTINGS.clubShortName),
    address: replaceLegacy(String(input.address || ""), LEGACY_COPY.address, ""),
    mapsQuery: replaceLegacy(String(input.mapsQuery || ""), LEGACY_COPY.mapsQuery, ""),
    whatsapp: replaceLegacy(String(input.whatsapp || "").replace(/\D/g, ""), LEGACY_COPY.whatsapp, ""),
    instagram: replaceLegacy(String(input.instagram || "").replace(/^@/, "").trim(), LEGACY_COPY.instagram, ""),
    openingHours: String(input.openingHours || DEFAULT_CLUB_SETTINGS.openingHours),
    homeHeadline: replaceLegacy(String(input.homeHeadline || DEFAULT_CLUB_SETTINGS.homeHeadline), LEGACY_COPY.homeHeadline, DEFAULT_CLUB_SETTINGS.homeHeadline),
    homeSubtitle: replaceLegacy(String(input.homeSubtitle || DEFAULT_CLUB_SETTINGS.homeSubtitle).replace("Reservá, pagá seña,", "Reservá, coordiná la seña con el club,"), LEGACY_COPY.homeSubtitle, DEFAULT_CLUB_SETTINGS.homeSubtitle),
    promoText: input.promoText === "9ª reserva bonificada" ? "" : String(input.promoText || DEFAULT_CLUB_SETTINGS.promoText),
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

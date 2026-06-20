// src/constants/routes.js
// Rutas centralizadas para evitar navegacion rota al cambiar URLs.
export const ROUTES = Object.freeze({
  HOME: "/",
  BOOKING: "/booking",
  BOOKING_LEGACY: "/reservar",
  MY_BOOKINGS: "/mis-turnos",
  TOURNAMENTS: "/torneos",
  COMMUNITY: "/comunidad",
  PLAYER: "/player",
  ACCOUNT: "/cuenta",
  TEACHER: "/profe",
  TEACHER_LEGACY: "/panel-profe",
  ADMIN: "/admin",
  ADMIN_CALENDAR: "/admin/calendar",
  ADMIN_TEACHERS: "/admin/teachers",
  ADMIN_BOOKINGS: "/admin/bookings",
  ADMIN_FINANCE: "/admin/finance",
  ADMIN_TOURNAMENTS: "/admin/tournaments",
  ADMIN_CONFIG: "/admin/config",
});

export function routeForRole(role) {
  if (role === "admin") return ROUTES.ADMIN;
  if (role === "teacher") return ROUTES.TEACHER;
  return ROUTES.MY_BOOKINGS;
}

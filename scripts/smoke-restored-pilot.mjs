import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { argentinaDateISO, canonicalCourtId } from "../src/utils/bookingDomain.js";

function expect(condition, message) {
  if (!condition) throw new Error(`Ensayo API del respaldo: ${message}`);
}

async function smokeBrowser({ apiBase, password, pilotName, pilotVenueName, pilotCourtName, date }) {
  process.env.VITE_API_URL = apiBase;
  const [{ createServer }, { chromium }] = await Promise.all([import("vite"), import("playwright")]);
  const vite = await createServer({ server: { host: "127.0.0.1", port: 5173, strictPort: true } });
  let browser;
  try {
    await vite.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://127.0.0.1:5173/clubes", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Ingresar" }).first().click();
    await page.locator('input[type="email"]').fill("restored-player@qa.invalid");
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Entrar al panel" }).click();
    await page.getByRole("link", { name: new RegExp(pilotName, "i") }).waitFor();
    await page.getByRole("link", { name: /Club QA/i }).waitFor();
    await page.getByRole("link", { name: new RegExp(pilotName, "i") }).click();
    await page.getByRole("heading", { name: pilotVenueName }).waitFor();
    await page.getByRole("link", { name: "Reservar cancha" }).click();
    await page.getByRole("heading", { name: "Reservá tu cancha" }).waitFor();
    await page.getByLabel("Fecha del turno").fill(date);
    await page.getByRole("combobox", { name: "Cancha" }).selectOption({ label: pilotCourtName });
    await page.getByText(`Horarios de ${pilotCourtName}`, { exact: true }).waitFor();
    await page.locator(".site-brand").click();
    await page.getByRole("link", { name: /Club QA/i }).click();
    await page.getByRole("heading", { name: "Sede QA" }).waitFor();
    await page.getByText("Cancha QA", { exact: true }).waitFor();
    return { browserSmokeVerified: true, browserMobileWidth: 390 };
  } finally {
    if (browser) await browser.close();
    await vite.close();
    delete process.env.VITE_API_URL;
  }
}

export async function smokeRestoredPilot({ uri, dbName, organizationSlug, venueSlug }) {
  if (!uri || !/^padelbook_[A-Za-z0-9_-]{1,50}_qa$/.test(dbName)) {
    throw new Error("El ensayo HTTP exige una MongoDB temporal de QA.");
  }
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = dbName;
  process.env.PADELBOOK_OPERATING_MODE = "multiclub";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  process.env.CLIENT_ORIGIN = "http://127.0.0.1:5173";
  process.env.PUBLIC_APP_ORIGIN = process.env.CLIENT_ORIGIN;
  process.env.RESEND_API_KEY = "";
  process.env.PASSWORD_RESET_FROM = "";

  const [{ connectDb }, { app }] = await Promise.all([import("../server/db.mjs"), import("../server/index.mjs")]);
  await connectDb();
  let server;
  try {
    const db = mongoose.connection.db;
    const pilot = await db.collection("organizations").findOne({ slug: organizationSlug });
    const pilotVenue = await db.collection("venues").findOne({ organizationId: pilot?._id, slug: venueSlug });
    const pilotCourt = await db.collection("courts").findOne({ organizationId: pilot?._id, venueId: pilotVenue?._id, active: { $ne: false } });
    expect(pilot && pilotVenue && pilotCourt, "el club migrado debe tener una sede y al menos una cancha activa");
    expect(canonicalCourtId(pilotCourt.courtId) === pilotCourt.courtId, "el ID de cancha heredado debe ser reservable por la API");

    const secondOrg = new mongoose.Types.ObjectId();
    const secondVenue = new mongoose.Types.ObjectId();
    const playerId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    const password = randomBytes(24).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 10);
    await db.collection("organizations").insertOne({ _id: secondOrg, slug: "qa-segundo-club", name: "Club QA", status: "active" });
    await db.collection("venues").insertOne({ _id: secondVenue, organizationId: secondOrg, slug: "qa-segunda-sede", name: "Sede QA", active: true });
    await db.collection("courts").insertOne({ organizationId: secondOrg, venueId: secondVenue, courtId: pilotCourt.courtId,
      name: "Cancha QA", active: true, openingTime: "09:00", closingTime: "22:00", slotIntervalMinutes: 30,
      allowedDurations: [60, 90, 120, 150], basePrice: 25000, nightPrice: 30000, weekendExtra: 0 });
    await db.collection("settings").insertOne({ organizationId: secondOrg, venueId: secondVenue, clubName: "Club QA" });
    await db.collection("users").insertMany([
      { _id: playerId, name: "Jugador QA", email: "restored-player@qa.invalid", passwordHash, role: "player", active: true },
      { _id: adminId, name: "Admin QA", email: "restored-admin@qa.invalid", passwordHash, role: "player", active: true },
    ]);
    await db.collection("memberships").insertMany([
      { organizationId: pilot._id, userId: playerId, role: "player", venueIds: [], active: true },
      { organizationId: secondOrg, userId: playerId, role: "player", venueIds: [], active: true },
      { organizationId: secondOrg, userId: adminId, role: "admin", venueIds: [secondVenue], active: true },
    ]);

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (path, options = {}) => {
      const response = await fetch(`${base}${path}`, options);
      return { status: response.status, body: await response.json() };
    };
    const pilotPath = `/venues/${organizationSlug}/${venueSlug}`;
    const secondPath = "/venues/qa-segundo-club/qa-segunda-sede";
    const health = await request("/health");
    expect(health.status === 200 && health.body.mode === "multiclub", "la API debe iniciar en modo multiclub");
    const [pilotPublic, courts, settings, secondPublic] = await Promise.all([
      request(pilotPath), request(`${pilotPath}/courts`), request(`${pilotPath}/settings`), request(secondPath),
    ]);
    expect(pilotPublic.status === 200 && courts.status === 200 && settings.status === 200 && secondPublic.status === 200,
      "ambas sedes y la configuración restaurada deben responder");
    expect(courts.body.courts.some((court) => court.id === pilotCourt.courtId), "la cancha real debe aparecer en la API");
    const date = argentinaDateISO(new Date(Date.now() + 7 * 86400000));
    const available = await request(`${pilotPath}/availability?date=${date}`);
    expect(available.status === 200 && Array.isArray(available.body.occupied), "la agenda real debe responder");
    const hours = courts.body.courts.find((court) => court.id === pilotCourt.courtId)?.hours || [];
    const duration = (pilotCourt.allowedDurations || [60]).includes(60) ? 60 : pilotCourt.allowedDurations?.[0];
    const start = hours.find((hour) => {
      const [h, m] = hour.split(":").map(Number);
      const [closeH, closeM] = String(pilotCourt.closingTime || "22:00").split(":").map(Number);
      return h * 60 + m + duration <= closeH * 60 + closeM;
    });
    expect(start && [60, 90, 120, 150].includes(duration), "la cancha real debe ofrecer un turno válido");

    const login = async (email) => {
      const result = await request("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }) });
      expect(result.status === 200 && result.body.token, "la cuenta de QA debe poder ingresar");
      return { Authorization: `Bearer ${result.body.token}`, "Content-Type": "application/json" };
    };
    const playerHeaders = await login("restored-player@qa.invalid");
    const adminHeaders = await login("restored-admin@qa.invalid");
    const portfolio = await request("/auth/organizations", { headers: playerHeaders });
    expect(portfolio.status === 200 && portfolio.body.organizations.length === 2, "el jugador debe ver sus dos clubes");
    const unauthorized = await request(`${pilotPath}/admin/bookings?date=${date}`, { headers: adminHeaders });
    expect(unauthorized.status === 403, "el administrador del segundo club no debe acceder al piloto");
    const bookingBody = { date, time: start, courtId: pilotCourt.courtId, durationMinutes: duration, type: "court", paymentOption: "cash" };
    const bookingOptions = (headers, body) => ({ method: "POST", headers, body: JSON.stringify(body) });
    const first = await request(`${pilotPath}/bookings`, bookingOptions(playerHeaders, bookingBody));
    expect(first.status === 201, "la cancha real migrada debe aceptar una reserva nueva");
    const duplicate = await request(`${pilotPath}/bookings`, bookingOptions(playerHeaders, bookingBody));
    expect(duplicate.status === 409, "la misma sede debe rechazar una reserva solapada");
    const second = await request(`${secondPath}/bookings`, bookingOptions(playerHeaders, bookingBody));
    expect(second.status === 201, "otra organización debe poder usar el mismo courtId y horario");
    const [pilotMine, secondMine] = await Promise.all([
      request(`${pilotPath}/bookings/mine`, { headers: playerHeaders }),
      request(`${secondPath}/bookings/mine`, { headers: playerHeaders }),
    ]);
    expect(pilotMine.status === 200 && secondMine.status === 200 &&
      pilotMine.body.bookings.some((booking) => booking.id === first.body.booking.id) &&
      secondMine.body.bookings.some((booking) => booking.id === second.body.booking.id) &&
      !pilotMine.body.bookings.some((booking) => booking.id === second.body.booking.id),
    "mis turnos debe mantener las reservas separadas");
    const browserSmoke = process.env.PADELBOOK_BROWSER_SMOKE === "true"
      ? await smokeBrowser({ apiBase: base, password, pilotName: pilot.name, pilotVenueName: pilotVenue.name,
        pilotCourtName: pilotCourt.name, date }) : {};
    return { apiSmokeVerified: true, realCourtBookable: true, sameVenueConflictRejected: true,
      crossOrganizationSlotReused: true, crossOrganizationAdminDenied: true, ...browserSmoke };
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
}

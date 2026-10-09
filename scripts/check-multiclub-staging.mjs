import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const origin = process.env.STAGING_ORIGIN;
const expectedHost = process.env.STAGING_EXPECTED_HOST;
const credentialsFromEnv = {
  cordoba: { email: process.env.STAGING_CORDOBA_OWNER_EMAIL, password: process.env.STAGING_CORDOBA_OWNER_PASSWORD },
  sierras: { email: process.env.STAGING_SIERRAS_OWNER_EMAIL, password: process.env.STAGING_SIERRAS_OWNER_PASSWORD },
  player: { email: process.env.STAGING_PLAYER_EMAIL, password: process.env.STAGING_PLAYER_PASSWORD },
  reception: { email: process.env.STAGING_RECEPTION_EMAIL, password: process.env.STAGING_RECEPTION_PASSWORD },
};
const credentials = process.env.STAGING_CREDENTIALS_FILE
  ? JSON.parse(await readFile(process.env.STAGING_CREDENTIALS_FILE, "utf8")) : credentialsFromEnv;
const proxySecret = process.env.STAGING_PROXY_SECRET_FILE
  ? (await readFile(process.env.STAGING_PROXY_SECRET_FILE, "utf8")).trim() : "";

if (!origin || !expectedHost || Object.values(credentials).some(({ email, password }) => !email || !password)) {
  throw new Error("Faltan el origen, el host esperado o las cuentas de QA.");
}

const base = new URL(origin);
const local = ["localhost", "127.0.0.1"].includes(base.hostname);
if (base.pathname !== "/" || base.search || base.hash || base.hostname !== expectedHost ||
  !(local ? base.protocol === "http:" : base.protocol === "https:") ||
  (!local && !/(?:stage|staging|qa)/i.test(base.hostname))) {
  throw new Error("El destino debe ser el origen exacto de QA o staging, nunca producción.");
}

const api = new URL("/api/", base);
const date = process.env.STAGING_SMOKE_DATE;
const todayParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Cordoba",
  year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today)) {
  throw new Error("STAGING_SMOKE_DATE debe ser una fecha futura AAAA-MM-DD.");
}

async function request(path, { method = "GET", session, body } = {}) {
  const headers = { Accept: "application/json" };
  if (proxySecret) headers["X-PadelBook-Proxy"] = proxySecret;
  if (session) {
    headers.Cookie = session.cookie;
    if (method !== "GET") headers["X-CSRF-Token"] = session.csrf;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(new URL(path.replace(/^\//, ""), api), {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(90_000),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, headers: response.headers };
}

async function login({ email, password }) {
  const result = await request("auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.status, 200, "No se pudo ingresar con una cuenta de QA");
  const cookie = result.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie && result.data.csrfToken, "La sesión no incluyó cookie y CSRF");
  return { cookie, csrf: result.data.csrfToken };
}

async function expectOrganizations(session, expected) {
  const result = await request("auth/organizations", { session });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.organizations.map(({ slug }) => slug).sort(), expected.sort());
}

const health = await request("health");
assert.equal(health.status, 200);
assert.equal(health.data.database, "connected");
assert.equal(health.data.mode, "multiclub");
assert.equal(health.data.writable, true);

const [cordoba, sierras, player, reception] = await Promise.all(
  ["cordoba", "sierras", "player", "reception"].map((key) => login(credentials[key])),
);
await Promise.all([
  expectOrganizations(cordoba, ["club-cordoba"]),
  expectOrganizations(sierras, ["club-sierras"]),
  expectOrganizations(player, ["club-cordoba", "club-sierras"]),
  expectOrganizations(reception, ["club-cordoba"]),
]);
assert.equal((await request("organizations/club-sierras/venues", { session: cordoba })).status, 404);
assert.equal((await request("organizations/club-cordoba/venues", { session: sierras })).status, 404);
assert.equal((await request("venues/club-cordoba/centro/admin/bookings", { session: reception })).status, 200);
assert.equal((await request("venues/club-cordoba/norte/admin/bookings", { session: reception })).status, 403);
assert.equal((await request("venues/club-sierras/villa-allende/admin/bookings", { session: reception })).status, 403);
assert.equal((await request("venues/club-cordoba/norte/admin/bookings", { session: cordoba })).status, 200);

for (const [organization, venue] of [["club-cordoba", "centro"], ["club-cordoba", "norte"], ["club-sierras", "villa-allende"]]) {
  const response = await request(`venues/${organization}/${venue}/courts`);
  assert.equal(response.status, 200);
  assert.ok(response.data.courts.some(({ id, courtId }) => (courtId || id) === "court1"), `Falta cancha de QA en ${organization}`);
}

console.log("Lecturas y permisos: OK; cada propietario ve solo su club.");
if (!date) {
  console.log("Reservas: no ejecutadas. Definí STAGING_SMOKE_DATE para crear y cancelar turnos de prueba.");
  process.exit(0);
}

const booking = { date, time: "11:00", courtId: "court1", type: "court", durationMinutes: 60, paymentOption: "cash" };
const venues = [["club-cordoba", "centro"], ["club-cordoba", "norte"], ["club-sierras", "villa-allende"]];
const created = [];
const blocksCreated = [];
let failure;
try {
  for (const [organization, venue] of venues) {
    const path = `venues/${organization}/${venue}/bookings`;
    const result = await request(path, { method: "POST", session: player, body: booking });
    assert.equal(result.status, 201, `No se pudo reservar en ${organization}`);
    created.push({ path, id: result.data.booking.id });
  }
  const occupied = await Promise.all(venues.map(async ([organization, venue]) => {
    const result = await request(`venues/${organization}/${venue}/availability?date=${date}`);
    assert.equal(result.status, 200);
    return result.data.occupied.some((item) => item.time === booking.time && item.courtId === booking.courtId);
  }));
  assert.deepEqual(occupied, [true, true, true]);
  const duplicate = await request(created[0].path, { method: "POST", session: player, body: booking });
  assert.equal(duplicate.status, 409, "Una reserva duplicada debe producir conflicto");
  const concurrent = await Promise.all([0, 1].map(() => request(created[0].path, { method: "POST", session: player,
    body: { ...booking, time: "14:00" } })));
  for (const result of concurrent) {
    if (result.status === 201) created.push({ path: created[0].path, id: result.data.booking.id });
  }
  assert.deepEqual(concurrent.map(({ status }) => status).sort(), [201, 409], "Dos jugadores no pueden tomar el mismo turno");
  const block = { date, courtId: "court1", hour: "16:00", durationMinutes: 60, reason: "QA concurrencia" };
  const blockPath = "venues/club-cordoba/centro/admin/blocks/batch";
  const [playerAttempt, receptionAttempt] = await Promise.all([
    request(created[0].path, { method: "POST", session: player, body: { ...booking, time: block.hour } }),
    request(blockPath, { method: "POST", session: reception, body: { blocks: [block] } }),
  ]);
  if (playerAttempt.status === 201) created.push({ path: created[0].path, id: playerAttempt.data.booking.id });
  if (receptionAttempt.status === 201) blocksCreated.push({ path: blockPath,
    key: { date, courtId: block.courtId, hour: block.hour } });
  assert.deepEqual([playerAttempt.status, receptionAttempt.status].sort(), [201, 409],
    "Recepción y jugador no pueden ocupar la misma franja");
  console.log("Tres sedes, disponibilidad, dobles reservas y bloqueo concurrente: OK.");
} catch (error) {
  failure = error;
} finally {
  for (const item of blocksCreated) {
    try {
      const removed = await request(item.path, { method: "DELETE", session: reception, body: { keys: [item.key] } });
      assert.equal(removed.status, 200);
    } catch (error) {
      failure = new Error(`No se pudo retirar un bloqueo de QA: ${error.message}`, { cause: failure || error });
    }
  }
  for (const item of created) {
    try {
      const cancelled = await request(`${item.path}/${item.id}/cancel`, { method: "POST", session: player });
      assert.equal(cancelled.status, 200);
    } catch (error) {
      failure = new Error(`No se pudo limpiar una reserva de QA: ${error.message}`, { cause: failure || error });
    }
  }
}
if (failure) throw failure;
console.log("Turnos de QA cancelados y agenda liberada: OK. Los registros cancelados permanecen en la auditoría.");

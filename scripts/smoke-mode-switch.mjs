import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function checkMode({ uri, dbName, mode, publicPath }) {
  const port = await availablePort();
  const child = spawn(process.execPath, [resolve("server/index.mjs")], {
    cwd: resolve("."), stdio: "ignore", env: { ...process.env, MONGODB_URI: uri, MONGODB_DB_NAME: dbName,
      PADELBOOK_OPERATING_MODE: mode, PORT: String(port), NODE_ENV: "test",
      JWT_SECRET: randomBytes(48).toString("hex"), RESEND_API_KEY: "", PASSWORD_RESET_FROM: "",
      PADELBOOK_DEMO_SEED: "false" },
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 25_000;
    let health;
    while (Date.now() < deadline && child.exitCode === null) {
      try {
        const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { health = await response.json(); break; }
      } catch { /* La API todavía está iniciando. */ }
      await new Promise((resolveWait) => setTimeout(resolveWait, 200));
    }
    if (!health || health.mode !== mode || health.database !== "connected") {
      throw new Error(`No arrancó la API ${mode} sobre la copia temporal ${dbName}.`);
    }
    const publicResponse = await fetch(`${base}${publicPath}`, { signal: AbortSignal.timeout(5000) });
    if (!publicResponse.ok) throw new Error(`La API ${mode} no pudo leer su copia temporal.`);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([new Promise((resolveExit) => child.once("exit", resolveExit)),
        new Promise((resolveWait) => setTimeout(resolveWait, 5000))]);
    }
  }
}

export async function smokeModeSwitch({ uri, legacyDbName, multiclubDbName, organizationSlug, venueSlug }) {
  if (!uri || ![legacyDbName, multiclubDbName].every((name) => /^padelbook_[A-Za-z0-9_-]{1,50}_qa$/.test(name)) ||
    legacyDbName === multiclubDbName) throw new Error("El cambio de modo exige dos bases temporales de QA distintas.");
  const legacy = { uri, dbName: legacyDbName, mode: "legacy", publicPath: "/api/courts" };
  const multiclub = { uri, dbName: multiclubDbName, mode: "multiclub",
    publicPath: `/api/venues/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(venueSlug)}` };
  await checkMode(legacy);
  await checkMode(multiclub);
  await checkMode(legacy);
  return { legacyBootVerified: true, multiclubBootVerified: true, legacyReturnVerified: true };
}

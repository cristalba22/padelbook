const origin = process.env.PADELBOOK_ORIGIN || "https://padelbook.crisalbavideografo.workers.dev";

async function verify(path, expectedJson = false) {
  const started = Date.now();
  const response = await fetch(new URL(path, origin), {
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  if (expectedJson) {
    const result = await response.json();
    if (result.ok !== true || result.database !== "connected") {
      throw new Error(`${path}: la API o MongoDB no están disponibles`);
    }
  } else if (!(response.headers.get("content-type") || "").includes("text/html")) {
    throw new Error(`${path}: no se recibió la página HTML`);
  }
  console.log(`${path}: OK (${Date.now() - started} ms)`);
}

for (let attempt = 1; attempt <= 2; attempt += 1) {
  try {
    await verify("/");
    await verify("/api/health", true);
    process.exit(0);
  } catch (error) {
    console.error(`Chequeo ${attempt}/2: ${error.message}`);
    if (attempt === 2) process.exit(1);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

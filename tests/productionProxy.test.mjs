import test from "node:test";
import assert from "node:assert/strict";

test("producción oculta la API cuando falta el secreto interno de Cloudflare", async (t) => {
  process.env.NODE_ENV = "production";
  process.env.CLIENT_ORIGIN = "https://club.example";
  process.env.MONGODB_URI = "mongodb+srv://app:private@cluster.example.mongodb.net/padelbook";
  process.env.MONGODB_DB_NAME = "padelbook_proxy_test";
  process.env.JWT_SECRET = "jwt-secret-for-production-proxy-test-with-more-than-forty-eight-characters";
  process.env.API_PROXY_SECRET = "proxy-secret-for-production-test-with-more-than-forty-eight-characters";
  process.env.PADELBOOK_DEMO_SEED = "false";

  const { app } = await import("../server/index.mjs");
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api`;

  const direct = await fetch(url);
  assert.equal(direct.status, 404);
  assert.deepEqual(await direct.json(), { message: "Recurso no encontrado." });

  const proxied = await fetch(url, { headers: { "X-PadelBook-Proxy": process.env.API_PROXY_SECRET } });
  assert.equal(proxied.status, 200);
  assert.equal((await proxied.json()).name, "PadelBook API");

  const health = await fetch(`${url}/health`);
  assert.equal(health.status, 503);
  assert.equal((await health.json()).database, "disconnected");
});

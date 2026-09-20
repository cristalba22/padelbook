import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/worker.js";

test("Cloudflare aplica CSP, anti-clickjacking y no cachea HTML", async () => {
  const env = {
    API_ORIGIN: "https://api.padelbook.example",
    ASSETS: { fetch: async () => new Response("<html></html>", { headers: { "content-type": "text/html" } }) },
  };
  const response = await worker.fetch(new Request("https://padelbook.example/admin"), env);
  const csp = response.headers.get("content-security-policy");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'self'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(response.headers.get("x-permitted-cross-domain-policies"), "none");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("Cloudflare ignora un origen de API inseguro en CSP", async () => {
  const env = { API_ORIGIN: "http://inseguro.example", ASSETS: { fetch: async () => new Response("ok") } };
  const response = await worker.fetch(new Request("https://padelbook.example"), env);
  assert.doesNotMatch(response.headers.get("content-security-policy"), /inseguro/);
});

test("Cloudflare no sirve el HTML de la SPA cuando la API no está configurada", async () => {
  const env = { API_ORIGIN: "", ASSETS: { fetch: async () => new Response("<html>demo</html>") } };
  const response = await worker.fetch(new Request("https://padelbook.example/api/health"), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).message, "La API del club no está configurada.");
});

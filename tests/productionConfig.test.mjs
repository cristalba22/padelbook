import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const valid = {
  NODE_ENV: "production",
  CLIENT_ORIGIN: "https://club.example",
  MONGODB_URI: "mongodb+srv://app:private@cluster.example.mongodb.net/padelbook",
  JWT_SECRET: "a-private-random-key-longer-than-forty-eight-characters-for-tests",
  PADELBOOK_DEMO_SEED: "false",
  API_PROXY_SECRET: "another-independent-random-secret-longer-than-forty-eight-characters",
};

function check(overrides = {}) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", "import('./server/config.mjs')"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, ...valid, ...overrides },
    encoding: "utf8",
  });
}

test("producción rechaza datos demo, HTTP y secretos débiles", () => {
  assert.equal(check().status, 0);
  assert.notEqual(check({ PADELBOOK_DEMO_SEED: "true" }).status, 0);
  assert.notEqual(check({ CLIENT_ORIGIN: "http://club.example" }).status, 0);
  assert.notEqual(check({ JWT_SECRET: "change-this-secret" }).status, 0);
  assert.notEqual(check({ MONGODB_DB_NAME: "club/invalido" }).status, 0);
  assert.notEqual(check({ CLIENT_ORIGIN: "https://club.example/path" }).status, 0);
  assert.notEqual(check({ MONGODB_URI: "mongodb://localhost:27017/padelbook" }).status, 0);
  assert.notEqual(check({ TOKEN_EXPIRES_IN: "24h" }).status, 0);
  assert.notEqual(check({ API_PROXY_SECRET: "weak" }).status, 0);
  assert.notEqual(check({ COOKIE_SAME_SITE: "lax" }).status, 0);
});

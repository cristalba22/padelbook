import test from "node:test";
import assert from "node:assert/strict";
import { generateSecurePassword } from "../src/utils/password.js";

test("genera contraseñas fuertes, variadas y dentro del límite admitido", () => {
  const passwords = Array.from({ length: 40 }, () => generateSecurePassword());
  for (const password of passwords) {
    assert.equal(password.length, 16);
    assert.match(password, /[a-z]/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[!@#$%*_+-]/);
  }
  assert.ok(new Set(passwords).size > 35);
  assert.equal(generateSecurePassword(5).length, 12);
  assert.equal(generateSecurePassword(100).length, 72);
});

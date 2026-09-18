import test from "node:test";
import assert from "node:assert/strict";
import { buildBookingWhatsAppUrl, cleanPhone } from "../src/utils/whatsapp.js";

test("el contacto de ejemplo no genera enlaces de WhatsApp", () => {
  assert.equal(cleanPhone("+54 9 351 000 0000"), "");
  assert.equal(buildBookingWhatsAppUrl({ phone: "+54 9 351 000 0000", player: "Jugador" }), null);
  assert.match(buildBookingWhatsAppUrl({ phone: "+54 9 351 555 1234", player: "Jugador" }), /^https:\/\/wa\.me\/5493515551234\?/);
});

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*-_+";
const ALL = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`;

function secureIndex(limit) {
  if (!globalThis.crypto?.getRandomValues) throw new Error("El navegador no permite generar una contraseña segura.");
  const ceiling = 256 - (256 % limit);
  const byte = new Uint8Array(1);
  do { globalThis.crypto.getRandomValues(byte); } while (byte[0] >= ceiling);
  return byte[0] % limit;
}

function pick(characters) {
  return characters[secureIndex(characters.length)];
}

export function generateSecurePassword(length = 16) {
  const safeLength = Math.max(12, Math.min(72, Number(length) || 16));
  const characters = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (characters.length < safeLength) characters.push(pick(ALL));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = secureIndex(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join("");
}

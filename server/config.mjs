import "dotenv/config";

export const PORT = Number(process.env.PORT || 4000);
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
export const TOKEN_EXPIRES_IN = "7d";
export const MONGODB_URI = process.env.MONGODB_URI || "";
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "padelbook";

if (!/^[a-zA-Z0-9_-]{3,64}$/.test(MONGODB_DB_NAME)) {
  throw new Error("MONGODB_DB_NAME debe tener entre 3 y 64 caracteres: letras, números, guion o guion bajo.");
}

if (process.env.NODE_ENV === "production") {
  if (process.env.PADELBOOK_DEMO_SEED === "true") {
    throw new Error("PADELBOOK_DEMO_SEED no puede estar activo en producción.");
  }
  if (!CLIENT_ORIGIN.startsWith("https://")) {
    throw new Error("CLIENT_ORIGIN debe ser una URL HTTPS en producción.");
  }
  if (!MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en producción.");
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes("change-this-secret")) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres privados en producción.");
  }
}

if (!process.env.JWT_SECRET) {
  throw new Error("Falta JWT_SECRET en .env. Configura una clave larga y privada antes de iniciar la API.");
}

export const JWT_SECRET = process.env.JWT_SECRET;

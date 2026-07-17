import "dotenv/config";

export const PORT = Number(process.env.PORT || 4000);
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
export const TOKEN_EXPIRES_IN = "7d";
export const MONGODB_URI = process.env.MONGODB_URI || "";

if (!process.env.JWT_SECRET) {
  throw new Error("Falta JWT_SECRET en .env. Configura una clave larga y privada antes de iniciar la API.");
}

export const JWT_SECRET = process.env.JWT_SECRET;

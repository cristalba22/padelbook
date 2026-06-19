import "dotenv/config";

export const PORT = Number(process.env.PORT || 4000);
export const JWT_SECRET = process.env.JWT_SECRET || "padelbook-dev-secret-change-me";
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
export const TOKEN_EXPIRES_IN = "7d";
export const MONGODB_URI = process.env.MONGODB_URI || "";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { EJSON } from "bson";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const MAGIC = Buffer.from("PBK1");

export function parseEncryptionKey(value = process.env.BACKUP_ENCRYPTION_KEY) {
  const raw = String(value || "").trim();
  const key = /^[a-f\d]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY debe contener 32 bytes (64 caracteres hex o base64).");
  return key;
}

export async function collectDatabase({ uri, dbName }) {
  const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    const db = client.db(dbName);
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name).filter((name) => !name.startsWith("system.")).sort();
    const collections = [];
    for (const name of names) {
      const collection = db.collection(name);
      const [documents, indexes] = await Promise.all([collection.find({}).toArray(), collection.indexes()]);
      collections.push({ name, documents, indexes: indexes.filter((index) => index.name !== "_id_").map(({ v: _v, ns: _ns, ...index }) => index) });
    }
    return { format: "padelbook-backup", version: 1, createdAt: new Date(), database: dbName, collections };
  } finally { await client.close(); }
}

export async function encryptBackup(payload, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const compressed = await gzipAsync(Buffer.from(EJSON.stringify(payload, { relaxed: false })));
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

export async function decryptBackup(buffer, key) {
  if (!Buffer.from(buffer).subarray(0, 4).equals(MAGIC)) throw new Error("El archivo no es un backup PadelBook válido.");
  const decipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(4, 16));
  decipher.setAuthTag(buffer.subarray(16, 32));
  const compressed = Buffer.concat([decipher.update(buffer.subarray(32)), decipher.final()]);
  const payload = EJSON.parse((await gunzipAsync(compressed)).toString("utf8"));
  if (payload?.format !== "padelbook-backup" || payload?.version !== 1 || !Array.isArray(payload.collections)) throw new Error("El contenido del backup no es compatible.");
  return payload;
}

export async function createBackupFile({ uri, dbName, output, encryptionKey }) {
  const payload = await collectDatabase({ uri, dbName });
  await writeFile(output, await encryptBackup(payload, encryptionKey));
  return { output, database: dbName, collections: payload.collections.length, documents: payload.collections.reduce((sum, item) => sum + item.documents.length, 0), createdAt: payload.createdAt };
}

export async function readBackupFile({ input, encryptionKey }) {
  return decryptBackup(await readFile(input), encryptionKey);
}

export async function restoreBackup({ uri, targetDbName, payload }) {
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(targetDbName)) throw new Error("Nombre de base destino inválido.");
  const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    const db = client.db(targetDbName);
    await db.dropDatabase();
    for (const item of payload.collections) {
      if (!/^[A-Za-z0-9_.-]{1,120}$/.test(item.name) || item.name.startsWith("system.")) throw new Error(`Colección inválida: ${item.name}`);
      const collection = db.collection(item.name);
      if (item.documents.length) await collection.insertMany(item.documents, { ordered: true });
      else await db.createCollection(item.name);
      for (const index of item.indexes || []) {
        const { key, name, ...options } = index;
        await collection.createIndex(key, { ...options, name });
      }
    }
    const counts = {};
    for (const item of payload.collections) counts[item.name] = await db.collection(item.name).countDocuments();
    return counts;
  } finally { await client.close(); }
}

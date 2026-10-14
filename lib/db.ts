import { createClient, type Client } from "@libsql/client";

// Satu koneksi dipakai bersama oleh seluruh server.
//
// - Production (Vercel): TURSO_DATABASE_URL = "libsql://nama-db.turso.io" + TURSO_AUTH_TOKEN.
// - Development: kalau TURSO_DATABASE_URL kosong, pakai file SQLite lokal `local.db`,
//   jadi aplikasi bisa dicoba tanpa akun Turso.
const url = process.env.TURSO_DATABASE_URL || "file:local.db";

if (!process.env.TURSO_DATABASE_URL && process.env.NODE_ENV === "production" && !process.env.CI) {
  console.warn("[db] TURSO_DATABASE_URL kosong, memakai file:local.db");
}

export const db: Client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

/** Untuk ditampilkan di log/halaman status, tanpa membocorkan token. */
export const lokasiDatabase = url.startsWith("file:") ? `file lokal (${url.slice(5)})` : "Turso";

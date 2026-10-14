import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { KATEGORI_BAWAAN } from "./kategori-bawaan";

/**
 * Membuat semua tabel lalu mengisi kategori bawaan.
 * Aman dijalankan berulang kali (IF NOT EXISTS + INSERT OR IGNORE).
 * Dipakai oleh `npm run db:setup` dan oleh test (database di memori).
 */
export async function siapkanDatabase(client: Client): Promise<void> {
  const sql = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  await client.executeMultiple(sql);

  await client.batch(
    KATEGORI_BAWAAN.map((k) => ({
      sql: "INSERT OR IGNORE INTO kategori (nama, jenis, ikon) VALUES (?, ?, ?)",
      args: [k.nama, k.jenis, k.ikon],
    })),
    "write",
  );
}

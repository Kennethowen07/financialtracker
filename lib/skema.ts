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
  await migrasi(client);

  await client.batch(
    KATEGORI_BAWAAN.map((k) => ({
      sql: "INSERT OR IGNORE INTO kategori (nama, jenis, ikon) VALUES (?, ?, ?)",
      args: [k.nama, k.jenis, k.ikon],
    })),
    "write",
  );
}

/** Kolom yang ditambahkan setelah tabel pertama kali dibuat. */
async function migrasi(client: Client): Promise<void> {
  const { rows } = await client.execute("PRAGMA table_info(transaksi)");
  const kolom = new Set(rows.map((r) => String(r.name)));
  if (!kolom.has("arah")) {
    await client.execute(
      "ALTER TABLE transaksi ADD COLUMN arah TEXT NOT NULL DEFAULT 'keluar' CHECK (arah IN ('keluar', 'masuk'))",
    );
    await client.execute("UPDATE transaksi SET arah = 'masuk' WHERE jenis = 'pemasukan'");
  }
  if (!kolom.has("dikoreksi")) {
    await client.execute(
      "ALTER TABLE transaksi ADD COLUMN dikoreksi INTEGER NOT NULL DEFAULT 0 CHECK (dikoreksi IN (0, 1))",
    );
  }
}

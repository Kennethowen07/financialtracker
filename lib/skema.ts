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
  // Database lama diubah dulu, karena schema.sql membuat index di kolom baru.
  await migrasi(client);

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

async function kolom(client: Client, tabel: string): Promise<Set<string>> {
  const { rows } = await client.execute(`PRAGMA table_info(${tabel})`);
  return new Set(rows.map((r) => String(r.name)));
}

/** Perubahan untuk database yang dibuat versi sebelumnya. Database baru dilewati. */
async function migrasi(client: Client): Promise<void> {
  const kolomTransaksi = await kolom(client, "transaksi");
  if (kolomTransaksi.size === 0) return; // database baru, tabel dibuat schema.sql

  if (!kolomTransaksi.has("arah")) {
    await client.execute(
      "ALTER TABLE transaksi ADD COLUMN arah TEXT NOT NULL DEFAULT 'keluar' CHECK (arah IN ('keluar', 'masuk'))",
    );
    await client.execute("UPDATE transaksi SET arah = 'masuk' WHERE jenis = 'pemasukan'");
  }
  if (!kolomTransaksi.has("dikoreksi")) {
    await client.execute(
      "ALTER TABLE transaksi ADD COLUMN dikoreksi INTEGER NOT NULL DEFAULT 0 CHECK (dikoreksi IN (0, 1))",
    );
  }
  if (!kolomTransaksi.has("pengguna_id")) await migrasiAkun(client);
  if (!kolomTransaksi.has("cara_input")) {
    await client.batch(
      [
        "ALTER TABLE transaksi ADD COLUMN cara_input TEXT NOT NULL DEFAULT 'ketik' CHECK (cara_input IN ('ketik', 'suara', 'form', 'import'))",
        "UPDATE transaksi SET cara_input = 'import' WHERE sumber = 'import'",
        "UPDATE transaksi SET cara_input = 'form' WHERE sumber = 'manual'",
      ],
      "write",
    );
  }
}

/**
 * Versi multi-akun: tambah kolom pengguna_id. Semua data lama mendapat pengguna_id NULL
 * dan dipindahkan ke akun admin saat admin pertama kali masuk (lib/akun.ts).
 *
 * SQLite tidak bisa mengubah aturan UNIQUE pada tabel yang sudah ada, jadi kategori, memori,
 * dan analisis dibuat ulang (buat tabel baru → salin isi → hapus yang lama → ganti nama).
 * Definisinya harus sama dengan db/schema.sql (dicek di skema.test.ts).
 * client.migrate() menjalankan semuanya dalam satu transaksi (berhasil semua atau tidak sama
 * sekali) dengan pemeriksaan foreign key dimatikan sementara, karena tabel kategori sempat dihapus.
 */
async function migrasiAkun(client: Client): Promise<void> {
  await client.migrate(
    [
      // Dibuat duluan karena kolom-kolom baru merujuk ke tabel ini.
      `CREATE TABLE IF NOT EXISTS pengguna (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id      TEXT    UNIQUE,
        email          TEXT    NOT NULL UNIQUE,
        nama           TEXT    NOT NULL,
        aktif          INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
        dibuat_pada    TEXT    NOT NULL,
        terakhir_masuk TEXT    NOT NULL
      )`,

      `CREATE TABLE kategori_baru (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        nama            TEXT    NOT NULL,
        jenis           TEXT    NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi')),
        ikon            TEXT    NOT NULL,
        buatan_pengguna INTEGER NOT NULL DEFAULT 0 CHECK (buatan_pengguna IN (0, 1)),
        pengguna_id     INTEGER REFERENCES pengguna (id)
      )`,
      `INSERT INTO kategori_baru (id, nama, jenis, ikon, buatan_pengguna)
         SELECT id, nama, jenis, ikon, buatan_pengguna FROM kategori`,
      "DROP TABLE kategori",
      "ALTER TABLE kategori_baru RENAME TO kategori",

      "ALTER TABLE transaksi ADD COLUMN pengguna_id INTEGER REFERENCES pengguna (id)",

      `CREATE TABLE memori_baru (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        kata_kunci       TEXT    NOT NULL,
        jenis            TEXT    NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi', 'usaha')),
        kategori_id      INTEGER REFERENCES kategori (id),
        asal             TEXT    NOT NULL CHECK (asal IN ('tanya_balik', 'koreksi', 'manual', 'ai', 'import')),
        terakhir_dipakai TEXT    NOT NULL,
        pengguna_id      INTEGER REFERENCES pengguna (id),
        UNIQUE (pengguna_id, kata_kunci),
        CHECK (jenis <> 'usaha' OR kategori_id IS NULL)
      )`,
      `INSERT INTO memori_baru (id, kata_kunci, jenis, kategori_id, asal, terakhir_dipakai)
         SELECT id, kata_kunci, jenis, kategori_id, asal, terakhir_dipakai FROM memori`,
      "DROP TABLE memori",
      "ALTER TABLE memori_baru RENAME TO memori",

      `CREATE TABLE analisis_baru (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        bulan       TEXT    NOT NULL CHECK (bulan GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
        isi         TEXT    NOT NULL,
        dibuat_pada TEXT    NOT NULL,
        pengguna_id INTEGER REFERENCES pengguna (id),
        UNIQUE (pengguna_id, bulan)
      )`,
      `INSERT INTO analisis_baru (id, bulan, isi, dibuat_pada)
         SELECT id, bulan, isi, dibuat_pada FROM analisis`,
      "DROP TABLE analisis",
      "ALTER TABLE analisis_baru RENAME TO analisis",
    ],
  );
}

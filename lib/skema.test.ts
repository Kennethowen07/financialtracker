import { describe, expect, test } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { buatDbUji, masukUji } from "./db-uji";
import { daftarKategori, KesalahanInput, tentukanKategori } from "./kategori";
import { siapkanDatabase } from "./skema";

// Skema versi sebelum ada akun (db/schema.sql di commit sebelum multi-akun).
const SKEMA_LAMA = `
CREATE TABLE kategori (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi')),
  ikon TEXT NOT NULL, buatan_pengguna INTEGER NOT NULL DEFAULT 0 CHECK (buatan_pengguna IN (0, 1)),
  UNIQUE (nama, jenis)
);
CREATE TABLE transaksi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal TEXT NOT NULL, nominal INTEGER NOT NULL CHECK (nominal > 0),
  jenis TEXT NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi', 'usaha')),
  arah TEXT NOT NULL DEFAULT 'keluar' CHECK (arah IN ('keluar', 'masuk')),
  kategori_id INTEGER REFERENCES kategori (id),
  deskripsi TEXT NOT NULL, teks_asli TEXT NOT NULL,
  sumber TEXT NOT NULL CHECK (sumber IN ('memori', 'ai', 'tanya_balik', 'manual', 'import')),
  dikoreksi INTEGER NOT NULL DEFAULT 0 CHECK (dikoreksi IN (0, 1)),
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX idx_transaksi_tanggal ON transaksi (tanggal);
CREATE TABLE memori (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kata_kunci TEXT NOT NULL UNIQUE,
  jenis TEXT NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi', 'usaha')),
  kategori_id INTEGER REFERENCES kategori (id),
  asal TEXT NOT NULL CHECK (asal IN ('tanya_balik', 'koreksi', 'manual', 'ai', 'import')),
  terakhir_dipakai TEXT NOT NULL
);
CREATE TABLE analisis (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bulan TEXT NOT NULL UNIQUE, isi TEXT NOT NULL, dibuat_pada TEXT NOT NULL
);
CREATE TABLE kuota_demo (
  alamat_ip TEXT NOT NULL, tanggal TEXT NOT NULL, jumlah_panggilan INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (alamat_ip, tanggal)
);
INSERT INTO kategori (id, nama, jenis, ikon) VALUES (1, 'Makanan & Minuman', 'pengeluaran', 'makan');
INSERT INTO kategori (id, nama, jenis, ikon, buatan_pengguna) VALUES (50, 'Hewan', 'pengeluaran', 'lainnya', 1);
INSERT INTO transaksi (tanggal, nominal, jenis, kategori_id, deskripsi, teks_asli, sumber, dibuat_pada)
  VALUES ('2026-10-01', 25000, 'pengeluaran', 1, 'rasela', 'rasela 25000', 'manual', '2026-10-01T00:00:00Z'),
         ('2026-10-02', 50000, 'pengeluaran', 50, 'pakan kucing', 'pakan kucing 50000', 'tanya_balik', '2026-10-02T00:00:00Z');
INSERT INTO memori (kata_kunci, jenis, kategori_id, asal, terakhir_dipakai)
  VALUES ('rasela', 'pengeluaran', 1, 'manual', '2026-10-01T00:00:00Z');
INSERT INTO analisis (bulan, isi, dibuat_pada) VALUES ('2026-10', 'Makan paling besar.', '2026-10-03T00:00:00Z');
`;

async function dbLama(): Promise<Client> {
  const db = createClient({ url: ":memory:" });
  await db.executeMultiple(SKEMA_LAMA);
  return db;
}

async function kolom(db: Client, tabel: string): Promise<string[]> {
  const { rows } = await db.execute(`PRAGMA table_info(${tabel})`);
  return rows.map((r) => String(r.name)).sort();
}

const hitung = async (db: Client, sql: string) => Number((await db.execute(sql)).rows[0].n);

describe("migrasi database lama ke multi-akun", () => {
  test("semua data lama tetap ada (id tidak berubah) dan belum punya pemilik", async () => {
    const db = await dbLama();
    await siapkanDatabase(db);

    expect(await hitung(db, "SELECT COUNT(*) AS n FROM transaksi WHERE pengguna_id IS NULL")).toBe(2);
    expect(await hitung(db, "SELECT COUNT(*) AS n FROM memori WHERE pengguna_id IS NULL")).toBe(1);
    expect(await hitung(db, "SELECT COUNT(*) AS n FROM analisis WHERE pengguna_id IS NULL")).toBe(1);
    const { rows } = await db.execute("SELECT kategori_id FROM transaksi WHERE deskripsi = 'pakan kucing'");
    expect(Number(rows[0].kategori_id)).toBe(50);
    // Kategori bawaan lain ikut terisi, tanpa duplikat "Makanan & Minuman".
    expect(await hitung(db, "SELECT COUNT(*) AS n FROM kategori WHERE nama = 'Makanan & Minuman'")).toBe(1);
    expect(await hitung(db, "SELECT COUNT(*) AS n FROM kategori WHERE buatan_pengguna = 0")).toBe(18);
  });

  test("kolom hasil migrasi sama dengan database baru", async () => {
    const lama = await dbLama();
    await siapkanDatabase(lama);
    const baru = await buatDbUji();
    for (const tabel of ["pengguna", "kategori", "transaksi", "memori", "analisis", "kuota_demo", "kuota_ai"]) {
      expect(await kolom(lama, tabel), tabel).toEqual(await kolom(baru, tabel));
    }
  });

  test("cara_input transaksi lama diisi dari sumbernya (manual → form, lainnya → ketik)", async () => {
    const db = await dbLama();
    await siapkanDatabase(db);
    const { rows } = await db.execute("SELECT deskripsi, cara_input FROM transaksi ORDER BY id");
    expect(rows.map((r) => [r.deskripsi, r.cara_input])).toEqual([["rasela", "form"], ["pakan kucing", "ketik"]]);
  });

  test("aman dijalankan berulang kali", async () => {
    const db = await dbLama();
    await siapkanDatabase(db);
    await siapkanDatabase(db);
    expect(await hitung(db, "SELECT COUNT(*) AS n FROM transaksi")).toBe(2);
  });

  test("sebelum admin login, kategori 'ketik sendiri' lama tidak terlihat akun lain", async () => {
    const db = await dbLama();
    await siapkanDatabase(db);
    const andi = await masukUji(db, { email: "andi@uji.id", nama: "Andi" }, new Date(), "bos@uji.id");
    const hewan = await hitung(db, "SELECT id AS n FROM kategori WHERE nama = 'Hewan'");

    expect((await daftarKategori(db, andi.id)).map((k) => k.nama)).not.toContain("Hewan");
    await expect(tentukanKategori(db, andi.id, "pengeluaran", { kategoriId: hewan })).rejects.toThrow(KesalahanInput);
    // Mengetik nama yang sama membuat kategori milik Andi sendiri, bukan memakai yang lama.
    const punyaAndi = await tentukanKategori(db, andi.id, "pengeluaran", { kategoriBaru: "Hewan" });
    expect(punyaAndi).not.toBe(hewan);
  });

  test("setelah admin login, data lama jadi miliknya; aturan unik sekarang per akun", async () => {
    const db = await dbLama();
    await siapkanDatabase(db);
    const bos = (await masukUji(db, { email: "bos@uji.id", nama: "Bos" }, new Date(), "bos@uji.id"));

    expect(await hitung(db, `SELECT COUNT(*) AS n FROM transaksi WHERE pengguna_id = ${bos.id}`)).toBe(2);
    expect(await hitung(db, `SELECT COUNT(*) AS n FROM kategori WHERE pengguna_id = ${bos.id}`)).toBe(1); // "Hewan"

    // Akun lain boleh punya memori "rasela" dan analisis bulan yang sama.
    const andi = (await masukUji(db, { email: "andi@uji.id", nama: "Andi" }, new Date(), "bos@uji.id"));
    await db.execute({
      sql: "INSERT INTO memori (pengguna_id, kata_kunci, jenis, asal, terakhir_dipakai) VALUES (?, 'rasela', 'pengeluaran', 'manual', 'x')",
      args: [andi.id],
    });
    await db.execute({
      sql: "INSERT INTO analisis (pengguna_id, bulan, isi, dibuat_pada) VALUES (?, '2026-10', 'punya andi', 'x')",
      args: [andi.id],
    });
    expect(await hitung(db, "SELECT COUNT(*) AS n FROM memori WHERE kata_kunci = 'rasela'")).toBe(2);
  });
});

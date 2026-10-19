-- Skema database Financial Detector.
-- Aman dijalankan berulang kali: semua perintah memakai IF NOT EXISTS.
-- Database lama (sebelum ada akun) diubah dulu oleh lib/skema.ts sebelum file ini dijalankan.
-- Format tanggal: YYYY-MM-DD (zona Asia/Jakarta). Format waktu: ISO-8601 UTC.

PRAGMA foreign_keys = ON;

-- Akun pengguna. Login lewat Google; admin = email yang sama dengan ADMIN_EMAIL.
CREATE TABLE IF NOT EXISTS pengguna (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  -- "sub" dari Google. NULL untuk akun yang dibuat lewat login developer (khusus laptop).
  google_id      TEXT    UNIQUE,
  -- Selalu huruf kecil.
  email          TEXT    NOT NULL UNIQUE,
  nama           TEXT    NOT NULL,
  -- 0 = dinonaktifkan admin, tidak bisa masuk.
  aktif          INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  dibuat_pada    TEXT    NOT NULL,
  terakhir_masuk TEXT    NOT NULL
);

-- Kolom pengguna_id di tabel-tabel berikut:
--   - berisi id pemilik data;
--   - NULL di kategori = kategori bawaan yang dipakai semua akun;
--   - NULL di transaksi/memori/analisis = data dari sebelum ada akun, otomatis
--     dipindahkan ke akun admin saat admin masuk (lib/akun.ts).

CREATE TABLE IF NOT EXISTS kategori (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nama            TEXT    NOT NULL,
  -- Usaha tidak punya kategori, jadi tidak ada di sini.
  jenis           TEXT    NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi')),
  -- Kunci ikon, dicocokkan ke gambar SVG di komponen React (mis. 'makan', 'transport').
  ikon            TEXT    NOT NULL,
  -- 1 kalau dibuat lewat opsi "ketik sendiri".
  buatan_pengguna INTEGER NOT NULL DEFAULT 0 CHECK (buatan_pengguna IN (0, 1)),
  pengguna_id     INTEGER REFERENCES pengguna (id)
);
-- Nama kategori unik per jenis, per akun (kategori bawaan dihitung sebagai akun "0").
CREATE UNIQUE INDEX IF NOT EXISTS idx_kategori_unik ON kategori (nama, jenis, IFNULL(pengguna_id, 0));

CREATE TABLE IF NOT EXISTS transaksi (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal     TEXT    NOT NULL CHECK (tanggal GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  nominal     INTEGER NOT NULL CHECK (nominal > 0),
  jenis       TEXT    NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi', 'usaha')),
  -- Arah uang. Pengeluaran & usaha selalu keluar, pemasukan selalu masuk.
  -- Investasi bisa keduanya: setoran (keluar) atau penarikan (masuk).
  arah        TEXT    NOT NULL DEFAULT 'keluar' CHECK (arah IN ('keluar', 'masuk')),
  -- NULL artinya kategori belum ditentukan (menunggu tanya balik), atau jenisnya usaha.
  kategori_id INTEGER REFERENCES kategori (id),
  deskripsi   TEXT    NOT NULL,
  teks_asli   TEXT    NOT NULL,
  -- Dari mana kategorinya berasal.
  sumber      TEXT    NOT NULL CHECK (sumber IN ('memori', 'ai', 'tanya_balik', 'manual', 'import')),
  -- 1 kalau jenis/kategorinya pernah diganti lewat edit (metrik akurasi).
  dikoreksi   INTEGER NOT NULL DEFAULT 0 CHECK (dikoreksi IN (0, 1)),
  dibuat_pada TEXT    NOT NULL,
  pengguna_id INTEGER REFERENCES pengguna (id),
  -- Cara transaksi dimasukkan (dipakai untuk mengukur pemakaian input suara).
  cara_input  TEXT    NOT NULL DEFAULT 'ketik' CHECK (cara_input IN ('ketik', 'suara', 'form', 'import')),
  -- Usaha tidak boleh punya kategori.
  CHECK (jenis <> 'usaha' OR kategori_id IS NULL),
  CHECK (jenis = 'investasi' OR arah = CASE jenis WHEN 'pemasukan' THEN 'masuk' ELSE 'keluar' END)
);
CREATE INDEX IF NOT EXISTS idx_transaksi_pengguna_tanggal ON transaksi (pengguna_id, tanggal);

CREATE TABLE IF NOT EXISTS memori (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Deskripsi utuh yang dinormalisasi (huruf kecil, spasi rapi), mis. 'kopi gereja'.
  kata_kunci       TEXT    NOT NULL,
  jenis            TEXT    NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi', 'usaha')),
  kategori_id      INTEGER REFERENCES kategori (id),
  -- Dari mana entri memori ini dipelajari.
  asal             TEXT    NOT NULL CHECK (asal IN ('tanya_balik', 'koreksi', 'manual', 'ai', 'import')),
  terakhir_dipakai TEXT    NOT NULL,
  pengguna_id      INTEGER REFERENCES pengguna (id),
  -- Tiap akun punya memorinya sendiri.
  UNIQUE (pengguna_id, kata_kunci),
  CHECK (jenis <> 'usaha' OR kategori_id IS NULL)
);

CREATE TABLE IF NOT EXISTS analisis (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bulan       TEXT    NOT NULL CHECK (bulan GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  isi         TEXT    NOT NULL,
  dibuat_pada TEXT    NOT NULL,
  pengguna_id INTEGER REFERENCES pengguna (id),
  UNIQUE (pengguna_id, bulan)
);

-- Kuota panggilan AI di mode demo. Batas total harian = SUM(jumlah_panggilan) per tanggal.
CREATE TABLE IF NOT EXISTS kuota_demo (
  alamat_ip        TEXT    NOT NULL,
  tanggal          TEXT    NOT NULL,
  jumlah_panggilan INTEGER NOT NULL DEFAULT 0 CHECK (jumlah_panggilan >= 0),
  PRIMARY KEY (alamat_ip, tanggal)
);

-- Kuota panggilan AI per akun per hari (admin tidak dibatasi). Kuota Gemini gratis dipakai bersama.
CREATE TABLE IF NOT EXISTS kuota_ai (
  pengguna_id INTEGER NOT NULL REFERENCES pengguna (id),
  tanggal     TEXT    NOT NULL,
  jumlah      INTEGER NOT NULL DEFAULT 0 CHECK (jumlah >= 0),
  PRIMARY KEY (pengguna_id, tanggal)
);

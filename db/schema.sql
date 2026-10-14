-- Skema database Financial Detector (sesuai docs/PRD.md bagian "Teknis dan data").
-- Aman dijalankan berulang kali: semua perintah memakai IF NOT EXISTS.
-- Format tanggal: YYYY-MM-DD (zona Asia/Jakarta). Format waktu: ISO-8601 UTC.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS kategori (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nama            TEXT    NOT NULL,
  -- Usaha tidak punya kategori, jadi tidak ada di sini.
  jenis           TEXT    NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi')),
  -- Kunci ikon, dicocokkan ke gambar SVG di komponen React (mis. 'makan', 'transport').
  ikon            TEXT    NOT NULL,
  -- 1 kalau dibuat lewat opsi "ketik sendiri".
  buatan_pengguna INTEGER NOT NULL DEFAULT 0 CHECK (buatan_pengguna IN (0, 1)),
  UNIQUE (nama, jenis)
);

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
  -- 1 kalau jenis/kategorinya pernah diganti lewat edit (metrik akurasi di PRD).
  dikoreksi   INTEGER NOT NULL DEFAULT 0 CHECK (dikoreksi IN (0, 1)),
  dibuat_pada TEXT    NOT NULL,
  -- Usaha tidak boleh punya kategori.
  CHECK (jenis <> 'usaha' OR kategori_id IS NULL),
  CHECK (jenis = 'investasi' OR arah = CASE jenis WHEN 'pemasukan' THEN 'masuk' ELSE 'keluar' END)
);
CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal ON transaksi (tanggal);

CREATE TABLE IF NOT EXISTS memori (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Deskripsi utuh yang dinormalisasi (huruf kecil, spasi rapi), mis. 'kopi gereja'.
  kata_kunci       TEXT    NOT NULL UNIQUE,
  jenis            TEXT    NOT NULL CHECK (jenis IN ('pengeluaran', 'pemasukan', 'investasi', 'usaha')),
  kategori_id      INTEGER REFERENCES kategori (id),
  -- Dari mana entri memori ini dipelajari.
  asal             TEXT    NOT NULL CHECK (asal IN ('tanya_balik', 'koreksi', 'manual', 'ai', 'import')),
  terakhir_dipakai TEXT    NOT NULL,
  CHECK (jenis <> 'usaha' OR kategori_id IS NULL)
);

CREATE TABLE IF NOT EXISTS analisis (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bulan       TEXT    NOT NULL UNIQUE CHECK (bulan GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  isi         TEXT    NOT NULL,
  dibuat_pada TEXT    NOT NULL
);

-- Kuota panggilan AI di mode demo. Batas total harian = SUM(jumlah_panggilan) per tanggal.
CREATE TABLE IF NOT EXISTS kuota_demo (
  alamat_ip        TEXT    NOT NULL,
  tanggal          TEXT    NOT NULL,
  jumlah_panggilan INTEGER NOT NULL DEFAULT 0 CHECK (jumlah_panggilan >= 0),
  PRIMARY KEY (alamat_ip, tanggal)
);

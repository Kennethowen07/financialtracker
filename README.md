# Financial Detector

Catat pengeluaran dengan mengetik bebas seperti `makan 25000`, langsung jadi dashboard bulanan.
Spesifikasi lengkap ada di [docs/PRD.md](docs/PRD.md), desain di [docs/design](docs/design/README.md),
dan keputusan yang melengkapi PRD di [docs/KEPUTUSAN.md](docs/KEPUTUSAN.md).

## Cara kerja singkat

1. Ketik di kotak input: `kopi 15000 roti 25000`, `kemarin bensin 30rb`, `+5000000`.
2. **Parser** (tanpa AI) membaca nominal, tanggal, dan memecah kalimat per nominal.
3. Tiap item dicek ke **memori** (tahan typo). Kalau ketemu, langsung tersimpan.
4. Kalau tidak, **Gemini** menebak jenis & kategori. Kalau ragu atau AI tidak tersedia, muncul **tanya balik**.
5. Jawaban dan koreksi disimpan ke memori, jadi input yang sama berikutnya langsung dikenali.

## Menjalankan di laptop

Butuh Node.js 22.

```bash
npm install
npm run db:setup      # buat tabel + isi kategori (file local.db)
npm run dev           # buka http://localhost:3000
```

Tanpa file `.env.local`, aplikasi tetap jalan: database memakai `local.db`, AI dianggap mati
(semua input baru memunculkan tanya balik), dan halaman `/masuk` menyediakan **login developer**
(ketik email apa saja, tanpa Google; hanya ada di laptop dan hanya saat memakai `local.db`, bukan Turso). Untuk mengaktifkan AI dan login Google,
salin `.env.example` menjadi `.env.local` lalu isi nilainya (lihat [docs/DEPLOY.md](docs/DEPLOY.md)).

Setiap akun hanya melihat datanya sendiri. Akun dengan email `ADMIN_EMAIL` menjadi admin.

Halaman:

| Alamat | Isi |
| --- | --- |
| `/` | Dashboard + kotak input (HP dan laptop) |
| `/analisis` | Analisis AI bulanan (tombol Perbarui) |
| `/akun` | Info akun dan tombol keluar (dibuka dari ikon orang di HP) |
| `/admin` | Daftar akun, nonaktifkan akun (khusus admin) |
| `/demo` | Mode demo tanpa akun: data di browser pengunjung, kuota 2 panggilan AI |
| `/masuk` | Login dengan Google (dan login developer di laptop) |

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server development |
| `npm test` | Semua test (Vitest) |
| `npm run typecheck` | Cek TypeScript |
| `npm run lint` | Cek ESLint |
| `npm run build` | Build production |
| `npm run db:setup` | Buat tabel & kategori (aman diulang) |
| `npm run import:siapkan` | Import langkah 1: spreadsheet lama → `data/import/deskripsi.csv` untuk dicek |
| `npm run import:jalankan` | Import langkah 2: CSV yang sudah dikoreksi → database |

## Import spreadsheet lama

1. Taruh `Pengeluaran 2026.xlsx` di folder project (file ini tidak ikut git).
2. `npm run import:siapkan`. Kalau `GEMINI_API_KEY` diisi, kolom kategori langsung berisi tebakan AI.
3. Buka `data/import/deskripsi.csv`, periksa kolom `jenis` dan `kategori` (nama persis seperti di aplikasi;
   usaha dibiarkan kosong).
4. Pastikan `ADMIN_EMAIL` diisi dan akun itu sudah pernah login sekali (data import masuk ke akun admin).
5. `npm run import:jalankan`. Kalau ada yang salah di CSV, tidak ada yang disimpan dan masalahnya ditampilkan.
   Untuk mengulang import: `npm run import:jalankan -- --ulang`.

## Struktur

```
app/              halaman (page.tsx) dan API (api/**/route.ts)
components/       komponen React (Dasbor, panel tanya balik, form, analisis, demo)
lib/              logika: parser, tanggal, memori, ai, transaksi, laporan, kuota, akun, google, sesi
db/schema.sql     skema database
scripts/          db-setup dan import spreadsheet
proxy.ts          proteksi login (halaman & API pribadi wajib login)
docs/             PRD, desain, keputusan, panduan deploy
legacy/           kode versi lama (Express + bot Telegram), tidak dipakai lagi
```

## Deploy

Lihat [docs/DEPLOY.md](docs/DEPLOY.md).

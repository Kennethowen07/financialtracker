# Financial Detector

Catat pengeluaran dengan mengetik bebas seperti `makan 25000`, langsung jadi dashboard bulanan.

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
salin `.env.example` menjadi `.env.local` lalu isi nilainya.

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
| `npm run mutasi:coba` | Uji baca screenshot mutasi di `data/mutasi/` lewat Gemini (tidak menyimpan apa pun) |
| `npm run db:backup` | Backup database (Turso / local.db) ke `backup/*.sql` |

## Struktur

```
app/              halaman (page.tsx) dan API (api/**/route.ts)
components/       komponen React (Dasbor, panel tanya balik, form, analisis, demo)
lib/              logika: parser, tanggal, memori, ai, transaksi, laporan, kuota, akun, google, sesi
db/schema.sql     skema database
scripts/          db-setup, backup, dan uji baca screenshot mutasi
proxy.ts          proteksi login (halaman & API pribadi wajib login)
legacy/           kode versi lama (Express + bot Telegram), tidak dipakai lagi
```

## Deploy

1. Buat database di [Turso](https://turso.tech), lalu jalankan `npm run db:setup` dengan
   `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN` di `.env.local`.
2. Buat OAuth Client ID (Web application) di Google Cloud Console dengan redirect URI
   `https://<nama-project>.vercel.app/api/auth/google/callback`.
3. Import repo ini di Vercel, isi environment variables sesuai `.env.example`, lalu deploy.

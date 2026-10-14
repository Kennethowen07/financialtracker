# 💸 Financial Detector

Pencatat keuangan pribadi lewat **Telegram** + **AI (Claude)** + **dashboard web**.

Ketik di Telegram seperti biasa:

```
makan 25000
kuota 100rb
bensin 30k, parkir 5000
kemarin nonton bioskop 50rb
gaji 5jt
```

AI otomatis memisahkan nominal, menentukan kategori (Makanan & Minuman, Transportasi, Pulsa & Internet, dst.), membaca tanggal ("kemarin", "tgl 3"), dan membedakan pengeluaran dari pemasukan. Semuanya masuk ke dashboard beserta analisis bulanan dari AI.

## Fitur

**Bot Telegram**
- Catat transaksi dengan bahasa bebas, bisa beberapa sekaligus dalam satu pesan
- Tombol **↩️ Batalkan** di setiap catatan
- `/hari`, `/minggu`, `/bulan`: ringkasan per kategori
- `/insight`: analisis AI bulan ini
- `/hapus`: hapus catatan terakhir
- Bot hanya merespons ID Telegram yang diizinkan (`ALLOWED_USER_IDS`)

**Dashboard** (`http://localhost:3000`), tema "Emerald Tenang"
- Sidebar dengan menu Dashboard / AI Analyzer dan pemilih bulan & tahun
- Total pengeluaran (dibandingkan dengan periode yang sama bulan lalu), jumlah transaksi, dan rata-rata per hari
- Grafik pengeluaran per kategori dan per hari
- Daftar transaksi yang bisa di-scroll, dengan filter kategori, edit, dan hapus
- Tombol **Tambah Pengeluaran** untuk mencatat manual tanpa lewat bot
- Halaman **AI Analyzer**: analisis AI per bulan (di-cache, hanya dibuat ulang kalau datanya berubah)
- Tampilan menyesuaikan di HP

**Tetap jalan tanpa AI.** Kalau API key kosong atau API sedang error, parser lokal tetap mencatat nominal dan menebak kategori dari kata kunci.

## Cara setup

Butuh **Node.js 22.13+** (cek dengan `node --version`).

### 1. Buat bot Telegram
1. Buka Telegram, chat **@BotFather**, kirim `/newbot`
2. Ikuti instruksinya (nama bot dan username yang berakhiran `bot`)
3. Simpan **token** yang diberikan

### 2. Ambil API key Claude
1. Buka https://platform.claude.com, login, isi saldo (billing)
2. Masuk ke **Settings → API Keys**, buat key baru

### 3. Isi konfigurasi
```bash
copy .env.example .env
```
Buka `.env`, lalu isi `TELEGRAM_BOT_TOKEN` dan `ANTHROPIC_API_KEY`.

### 4. Jalankan
```bash
npm install
npm start
```

### 5. Hubungkan akun Telegram kamu
1. Buka bot kamu di Telegram, kirim `/start`
2. Bot akan membalas dengan **ID Telegram** kamu
3. Isi `ALLOWED_USER_IDS=<ID kamu>` di `.env`
4. Matikan aplikasi (Ctrl+C), lalu jalankan `npm start` lagi

Selesai. Coba kirim `makan 25000`, lalu buka http://localhost:3000.

## Mencoba dashboard dengan data contoh

```bash
npm run demo:seed
npm run demo
```
Data contoh disimpan di `data/demo.db`, terpisah dari data asli.

## Biaya AI

Setiap pesan = 1 panggilan ke Claude. Analisis bulanan hanya dipanggil saat dibuka dan datanya berubah.
Model default `claude-opus-5-5` (paling akurat). Kalau mau jauh lebih hemat, ganti di `.env`:
```
CLAUDE_MODEL=claude-haiku-5-5
```
Untuk pencatatan sederhana seperti ini, Haiku biasanya sudah cukup.

## Supaya bot jalan 24 jam

Bot berjalan selama `npm start` aktif di laptop. Supaya selalu online, jalankan di server (VPS, Railway, Fly.io, dll.). Kalau dashboard dibuka dari internet, **wajib** isi `DASHBOARD_PASSWORD` dan set `HOST=0.0.0.0`.

## Struktur project

```
src/
  index.js       entry point (jalankan server + bot)
  bot.js         perintah & handler Telegram
  ai.js          Claude: baca pesan → transaksi, analisis bulanan
  parser.js      parser lokal (cadangan tanpa AI)
  categories.js  daftar kategori + kata kunci
  db.js          database SQLite (node:sqlite bawaan Node)
  server.js      API dashboard
  config.js      baca .env
public/          halaman dashboard (HTML/CSS/JS, tanpa library)
test/            npm test
data/            database (tidak ikut git)
```

Menambah atau mengubah kategori cukup di `src/categories.js`.

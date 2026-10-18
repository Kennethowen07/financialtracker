// Screenshot mutasi / riwayat transaksi (BCA, blu, GoPay, Grab, ShopeePay, ...) → daftar transaksi
// untuk diperiksa pengguna sebelum disimpan (docs/PRD.md "Pertanyaan terbuka" no. 1).
// Gambar dibaca Gemini; di sini hasilnya divalidasi supaya data yang tidak masuk akal tidak lolos.

/**
 * Golongan transaksi menurut isi mutasi.
 * - belanja: bayar ke toko/layanan (QRIS, debit, GrabFood, ShopeeFood, ...)
 * - transfer: kirim/terima uang ke/dari orang lain
 * - isi_saldo: top up / isi saldo / pindah uang ke rekening atau e-wallet sendiri
 */
export type GolonganMutasi = "belanja" | "transfer" | "isi_saldo";

export interface BarisMutasi {
  tanggal: string;
  /** Sudah dirapikan, mis. "00000.00IDM INDOMA" → "Indomaret". */
  keterangan: string;
  nominal: number;
  arah: "keluar" | "masuk";
  golongan: GolonganMutasi;
  /** Nama aplikasi sumber, mis. "BCA", "blu", "GoPay". */
  sumber: string;
  /** Baris terpotong di tepi screenshot (keterangan/nominal mungkin tidak lengkap). */
  terpotong: boolean;
  /** Masih pending/diproses di aplikasinya. */
  pending: boolean;
}

export const SISTEM_MUTASI = `Kamu membaca screenshot riwayat transaksi / mutasi dari aplikasi bank atau e-wallet Indonesia (BCA m-Info/myBCA, blu, GoPay, Grab, ShopeePay, OVO, SeaBank, Jago, dan lainnya).
Keluarkan SEMUA baris transaksi yang terlihat, dari atas ke bawah. Abaikan teks yang bukan transaksi (judul, saldo, ringkasan bulanan, tombol, nomor rekening pemilik).

Untuk tiap transaksi:
- tanggal: format YYYY-MM-DD. Kalau tahun tidak tertulis, ambil dari baris lain atau dari tanggal hari ini yang diberikan. "Today"/"Hari ini" = tanggal hari ini. Baris "PEND" di BCA memakai tanggal dari "TGL: MMDD".
- keterangan: singkat seperti orang mencatat pengeluaran, berisi nama toko, layanan, atau penerima. Buang kode, angka referensi, dan awalan seperti "00000.00", "TRANSAKSI DEBIT", "QR 014", "Transaksi Debit di". Contoh: "00000.00IDM INDOMA" → "Indomaret", "Payment To GrabFood" → "GrabFood", "Ride" di aplikasi Grab → "Grab ride", "Transfer to Andika Arta Pratama" → "Transfer Andika Arta Pratama".
- nominal: rupiah utuh tanpa titik dan tanpa desimal ("Rp. 13,900.00" → 13900, "Rp25.500,00" → 25500).
- arah: "keluar" (DB, minus, pembayaran, transfer keluar) atau "masuk" (CR, plus, pemasukan, refund).
- golongan: "isi_saldo" untuk top up, isi saldo, atau perpindahan uang ke rekening/e-wallet milik sendiri; "transfer" untuk kirim/terima uang ke/dari orang; selain itu "belanja".
- sumber: nama aplikasinya (mis. "BCA", "blu", "GoPay", "Grab", "ShopeePay").
- terpotong: true kalau baris itu terpotong di tepi atas/bawah gambar.
- pending: true kalau ditandai pending/PEND/diproses.
Jangan mengarang transaksi yang tidak terlihat.`;

export const SKEMA_MUTASI = {
  type: "object",
  properties: {
    transaksi: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tanggal: { type: "string" },
          keterangan: { type: "string" },
          nominal: { type: "number" },
          arah: { type: "string", enum: ["keluar", "masuk"] },
          golongan: { type: "string", enum: ["belanja", "transfer", "isi_saldo"] },
          sumber: { type: "string" },
          terpotong: { type: "boolean" },
          pending: { type: "boolean" },
        },
        required: ["tanggal", "keterangan", "nominal", "arah", "golongan", "sumber", "terpotong", "pending"],
      },
    },
  },
  required: ["transaksi"],
};

const GOLONGAN: GolonganMutasi[] = ["belanja", "transfer", "isi_saldo"];

function tanggalSah(t: unknown, hariIni: string): t is string {
  if (typeof t !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t && t <= hariIni;
}

/**
 * JSON dari Gemini → baris yang lolos validasi. Baris dengan tanggal tidak valid / masa depan,
 * nominal bukan bilangan bulat positif, atau keterangan kosong dibuang (lebih baik hilang satu
 * baris daripada menyimpan angka karangan).
 */
export function olahHasilMutasi(json: string, hariIni: string): BarisMutasi[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const daftar = (data as { transaksi?: unknown })?.transaksi;
  if (!Array.isArray(daftar)) return [];

  const hasil: BarisMutasi[] = [];
  for (const r of daftar as Record<string, unknown>[]) {
    const nominal = typeof r?.nominal === "number" ? Math.round(r.nominal) : NaN;
    const keterangan = typeof r?.keterangan === "string" ? r.keterangan.trim().replace(/\s+/g, " ").slice(0, 100) : "";
    if (!tanggalSah(r?.tanggal, hariIni) || !(nominal > 0 && nominal <= 1_000_000_000_000) || !keterangan) continue;
    hasil.push({
      tanggal: r.tanggal as string,
      keterangan,
      nominal,
      arah: r.arah === "masuk" ? "masuk" : "keluar",
      golongan: GOLONGAN.includes(r.golongan as GolonganMutasi) ? (r.golongan as GolonganMutasi) : "belanja",
      sumber: typeof r.sumber === "string" ? r.sumber.trim().slice(0, 30) : "",
      terpotong: r.terpotong === true,
      pending: r.pending === true,
    });
  }
  return hasil;
}

/** Konteks yang dikirim bersama gambar. */
export function konteksMutasi(hariIni: string): string {
  return `Tanggal hari ini: ${hariIni}. Baca semua transaksi di screenshot ini.`;
}

// ---------- layar periksa ----------

/** Satu baris di layar periksa: hasil baca + kategori dari memori + apakah dicentang. */
export interface ItemPeriksa extends BarisMutasi {
  /** Kategori dari memori (null = belum dikenal, nanti ditanyakan). */
  kategori: { id: number; nama: string; ikon: string } | null;
  jenis: "pengeluaran" | "pemasukan" | "investasi" | "usaha";
  /** Sudah ada transaksi akun ini dengan tanggal, nominal, dan arah yang sama. */
  tercatat: boolean;
  /** Urutan screenshot asal (diisi browser). Baris dari screenshot yang sama tidak dianggap dobel. */
  gambar?: number;
}

export type AlasanTidakDicentang = "isi_saldo" | "tercatat" | "dobel";

export interface BarisPeriksa extends ItemPeriksa {
  centang: boolean;
  /** Kenapa awalnya tidak dicentang (pengguna tetap bisa mencentang). */
  alasan: AlasanTidakDicentang | null;
  /** Untuk alasan "dobel": sumber baris yang sama di screenshot lain. */
  samaDengan?: string;
}

const kunciDobel = (b: { tanggal: string; nominal: number; arah: string }) => `${b.tanggal}|${b.nominal}|${b.arah}`;

/**
 * Tentukan centang awal semua baris dari satu atau beberapa screenshot (docs/KEPUTUSAN.md 42+):
 * - top up / isi saldo / pindah ke rekening sendiri → tidak dicentang (supaya tidak dihitung dua kali)
 * - sudah tercatat (tanggal + nominal + arah sama) → tidak dicentang
 * - sama dengan baris dari screenshot LAIN (mis. blu "Grab" dan Grab "GrabFood", atau dua screenshot
 *   yang bertumpuk karena di-scroll) → yang belakangan tidak dicentang. Nominal sama di screenshot yang
 *   sama (mis. empat transfer GoPay Rp100.000) tetap dianggap transaksi berbeda.
 */
export function tandaiPeriksa(items: ItemPeriksa[]): BarisPeriksa[] {
  const dilihat = new Map<string, { gambar: number; sumber: string }>();
  return items.map((it) => {
    const kunci = kunciDobel(it);
    const gambar = it.gambar ?? 0;
    const pertama = dilihat.get(kunci);
    if (!pertama) dilihat.set(kunci, { gambar, sumber: it.sumber });
    if (it.golongan === "isi_saldo") return { ...it, centang: false, alasan: "isi_saldo" };
    if (it.tercatat) return { ...it, centang: false, alasan: "tercatat" };
    if (pertama && pertama.gambar !== gambar) return { ...it, centang: false, alasan: "dobel", samaDengan: pertama.sumber };
    return { ...it, centang: true, alasan: null };
  });
}

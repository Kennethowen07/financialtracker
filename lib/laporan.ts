// Ringkasan bulanan untuk dashboard dan Analisis AI. Fungsi murni (tanpa database),
// jadi dipakai sama persis di browser (dashboard, mode demo) dan di server (Analisis AI).
// Aturan: docs/PRD.md fitur 8 dan paragraf "Week dihitung per bulan".
import { normalisasi } from "./memori";
import type { Transaksi } from "./transaksi";

export interface Minggu {
  label: "W1" | "W2" | "W3" | "W4";
  dari: number;
  sampai: number;
  total: number;
}

export interface BarisKategori {
  kategoriId: number | null;
  nama: string;
  ikon: string;
  total: number;
  jumlah: number;
}

export interface RingkasanBulan {
  bulan: string;
  /** Total pengeluaran (tanpa usaha dan investasi). */
  pengeluaran: number;
  masuk: number;
  /** masuk − pengeluaran */
  sisa: number;
  investasiKeluar: number;
  investasiMasuk: number;
  usaha: number;
  /** Pengeluaran hari ini; null kalau yang dilihat bukan bulan berjalan. */
  hariIni: number | null;
  /** Perubahan pengeluaran dibanding periode yang sama bulan lalu, dalam persen. */
  perubahanPersen: number | null;
  pengeluaranBulanLalu: number;
  minggu: Minggu[];
  /** Indeks minggu berjalan (0–3), null kalau bukan bulan berjalan. */
  mingguBerjalan: number | null;
  perKategori: BarisKategori[];
  palingSering: { deskripsi: string; kali: number; total: number }[];
  jumlahTransaksi: number;
}

/** Tanggal 1–7 → 0, 8–14 → 1, 15–21 → 2, 22 sampai akhir bulan → 3. */
export function indeksMinggu(tanggal: string): number {
  const hari = Number(tanggal.slice(8, 10));
  return Math.min(3, Math.floor((hari - 1) / 7));
}

function jumlahHari(bulan: string): number {
  const [t, b] = bulan.split("-").map(Number);
  return new Date(Date.UTC(t, b, 0)).getUTCDate();
}

const BELUM_ADA_KATEGORI = { nama: "Belum dikategorikan", ikon: "tanya" };

export function ringkas(
  bulan: string,
  transaksi: Transaksi[],
  transaksiBulanLalu: Transaksi[],
  hariIni: string,
): RingkasanBulan {
  const ini = transaksi.filter((t) => t.tanggal.startsWith(bulan));
  const keluar = ini.filter((t) => t.jenis === "pengeluaran");
  const jumlah = (list: Transaksi[]) => list.reduce((s, t) => s + t.nominal, 0);

  const pengeluaran = jumlah(keluar);
  const masuk = jumlah(ini.filter((t) => t.jenis === "pemasukan"));
  const investasi = ini.filter((t) => t.jenis === "investasi");

  const bulanBerjalan = hariIni.startsWith(bulan);
  const hariKe = Number(hariIni.slice(8, 10));

  // Periode yang sama bulan lalu: tanggal 1 sampai tanggal hari ini (kalau bulan berjalan).
  const pembanding = transaksiBulanLalu.filter(
    (t) => t.jenis === "pengeluaran" && (!bulanBerjalan || Number(t.tanggal.slice(8, 10)) <= hariKe),
  );
  const pengeluaranBulanLalu = jumlah(pembanding);
  const perubahanPersen = pengeluaranBulanLalu > 0
    ? Math.round(((pengeluaran - pengeluaranBulanLalu) / pengeluaranBulanLalu) * 1000) / 10
    : null;

  const akhir = jumlahHari(bulan);
  const minggu: Minggu[] = [
    { label: "W1", dari: 1, sampai: 7, total: 0 },
    { label: "W2", dari: 8, sampai: 14, total: 0 },
    { label: "W3", dari: 15, sampai: 21, total: 0 },
    { label: "W4", dari: 22, sampai: akhir, total: 0 },
  ];
  for (const t of keluar) minggu[indeksMinggu(t.tanggal)].total += t.nominal;

  const perKategoriMap = new Map<string, BarisKategori>();
  for (const t of keluar) {
    const kunci = String(t.kategori?.id ?? "kosong");
    const baris = perKategoriMap.get(kunci) ?? {
      kategoriId: t.kategori?.id ?? null,
      nama: t.kategori?.nama ?? BELUM_ADA_KATEGORI.nama,
      ikon: t.kategori?.ikon ?? BELUM_ADA_KATEGORI.ikon,
      total: 0,
      jumlah: 0,
    };
    baris.total += t.nominal;
    baris.jumlah += 1;
    perKategoriMap.set(kunci, baris);
  }

  const seringMap = new Map<string, { deskripsi: string; kali: number; total: number }>();
  for (const t of keluar) {
    const kunci = normalisasi(t.deskripsi);
    const baris = seringMap.get(kunci) ?? { deskripsi: kunci, kali: 0, total: 0 };
    baris.kali += 1;
    baris.total += t.nominal;
    seringMap.set(kunci, baris);
  }

  return {
    bulan,
    pengeluaran,
    masuk,
    sisa: masuk - pengeluaran,
    investasiKeluar: jumlah(investasi.filter((t) => t.arah === "keluar")),
    investasiMasuk: jumlah(investasi.filter((t) => t.arah === "masuk")),
    usaha: jumlah(ini.filter((t) => t.jenis === "usaha")),
    hariIni: bulanBerjalan ? jumlah(keluar.filter((t) => t.tanggal === hariIni)) : null,
    perubahanPersen,
    pengeluaranBulanLalu,
    minggu,
    mingguBerjalan: bulanBerjalan ? indeksMinggu(hariIni) : null,
    perKategori: [...perKategoriMap.values()].sort((a, b) => b.total - a.total),
    palingSering: [...seringMap.values()].sort((a, b) => b.kali - a.kali || b.total - a.total).slice(0, 10),
    jumlahTransaksi: ini.length,
  };
}

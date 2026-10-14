// Format tampilan: rupiah dan tanggal Indonesia. Aman dipakai di browser dan server.
import { tambahHari } from "./tanggal";

const angka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 3799892 → "Rp3.799.892" (sesuai desain, tanpa spasi). */
export function rupiah(n: number): string {
  return `${n < 0 ? "−" : ""}Rp${angka.format(Math.abs(Math.round(n)))}`;
}

/** 1500000 → "1.500.000" (untuk isian nominal). */
export function ribuan(n: number): string {
  return angka.format(n);
}

export const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-10" → "Oktober 2026" */
export function namaBulan(bulan: string): string {
  return `${NAMA_BULAN[Number(bulan.slice(5, 7)) - 1]} ${bulan.slice(0, 4)}`;
}

/** "2026-10-03" → "3 Okt" */
export function tanggalPendek(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${BULAN_PENDEK[Number(iso.slice(5, 7)) - 1]}`;
}

/** "Hari ini", "Kemarin", atau "3 Okt" (ditambah tahun kalau beda tahun). */
export function namaHari(iso: string, hariIni: string): string {
  if (iso === hariIni) return "Hari ini";
  if (iso === tambahHari(hariIni, -1)) return "Kemarin";
  return iso.slice(0, 4) === hariIni.slice(0, 4) ? tanggalPendek(iso) : `${tanggalPendek(iso)} ${iso.slice(0, 4)}`;
}

/** "Hari ini, 15 Okt" / "Kemarin, 14 Okt" / "3 Okt" — label tombol tanggal di form. */
export function labelTanggal(iso: string, hariIni: string): string {
  const nama = namaHari(iso, hariIni);
  return nama === "Hari ini" || nama === "Kemarin" ? `${nama}, ${tanggalPendek(iso)}` : nama;
}

/** 12.8 → "12,8%" */
export function persen(n: number): string {
  return `${Math.abs(n).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

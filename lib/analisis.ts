// Analisis AI bulanan.
// Hanya dijalankan lewat tombol "Perbarui"; hasilnya disimpan per bulan di tabel analisis.
// Yang dikirim ke AI hanya ringkasan + 10 deskripsi tersering, bukan daftar transaksi.
import type { Client } from "@libsql/client";
import type { AlasanAiGagal } from "./ai";
import { ringkas, type RingkasanBulan } from "./laporan";
import { bulanSebelumnya, hariIni as hariIniJakarta } from "./tanggal";
import { daftarTransaksi, type Deps } from "./transaksi";

export interface Analisis {
  bulan: string;
  isi: string;
  dibuatPada: string;
}

export async function ambilAnalisis(db: Client, penggunaId: number, bulan: string): Promise<Analisis | null> {
  const { rows } = await db.execute({
    sql: "SELECT bulan, isi, dibuat_pada FROM analisis WHERE pengguna_id = ? AND bulan = ?",
    args: [penggunaId, bulan],
  });
  if (!rows[0]) return null;
  return { bulan: String(rows[0].bulan), isi: String(rows[0].isi), dibuatPada: String(rows[0].dibuat_pada) };
}

/** Data yang dikirim ke AI: ringkasan saja, tanpa nominal per transaksi. */
export function dataUntukAI(r: RingkasanBulan) {
  return {
    bulan: r.bulan,
    pengeluaran: r.pengeluaran,
    pemasukan: r.masuk,
    sisa: r.sisa,
    investasi: { keluar: r.investasiKeluar, masuk: r.investasiMasuk },
    pengeluaran_usaha: r.usaha,
    pembanding_bulan_lalu: {
      pengeluaran_periode_sama: r.pengeluaranBulanLalu,
      perubahan_persen: r.perubahanPersen,
    },
    per_kategori: r.perKategori.map((k) => ({ kategori: k.nama, total: k.total, jumlah: k.jumlah })),
    per_minggu: r.minggu.map((m) => ({ minggu: m.label, tanggal: `${m.dari}-${m.sampai}`, total: m.total })),
    deskripsi_tersering: r.palingSering.map((s) => ({ deskripsi: s.deskripsi, kali: s.kali, total: s.total })),
  };
}

export type HasilAnalisis = { ok: true; analisis: Analisis } | { ok: false; alasan: AlasanAiGagal | "tanpa_data" };

export async function perbaruiAnalisis(deps: Deps, bulan: string): Promise<HasilAnalisis> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const [ini, lalu] = await Promise.all([
    daftarTransaksi(deps.db, deps.penggunaId, bulan),
    daftarTransaksi(deps.db, deps.penggunaId, bulanSebelumnya(bulan)),
  ]);
  if (ini.length === 0) return { ok: false, alasan: "tanpa_data" };

  const r = ringkas(bulan, ini, lalu, hariIniJakarta(sekarang));
  const hasil = await deps.ai.buatAnalisis(dataUntukAI(r));
  if (!hasil.ok) return hasil;

  const analisis: Analisis = { bulan, isi: hasil.data.trim(), dibuatPada: sekarang.toISOString() };
  await deps.db.execute({
    sql: `INSERT INTO analisis (pengguna_id, bulan, isi, dibuat_pada) VALUES (?, ?, ?, ?)
          ON CONFLICT (pengguna_id, bulan) DO UPDATE SET isi = excluded.isi, dibuat_pada = excluded.dibuat_pada`,
    args: [deps.penggunaId, analisis.bulan, analisis.isi, analisis.dibuatPada],
  });
  return { ok: true, analisis };
}

// Kuota AI mode demo (docs/PRD.md "Mode demo"): 2 panggilan per pengunjung (per IP, per hari)
// ditambah batas total harian untuk semua pengunjung. Dihitung di server, bukan di browser.
import type { Client } from "@libsql/client";

export const KUOTA_PER_IP = 2;

export function batasHarian(): number {
  return Number(process.env.DEMO_BATAS_HARIAN) || 100;
}

/** IP disimpan sebagai hash (bukan alamat aslinya). */
export async function hashIp(ip: string): Promise<string> {
  const garam = process.env.SESSION_SECRET || "financial-detector";
  const hasil = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${garam}|${ip}`));
  return [...new Uint8Array(hasil)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sisaKuota(db: Client, ip: string, tanggal: string, batas = batasHarian()): Promise<number> {
  const { rows } = await db.execute({
    sql: `SELECT
            COALESCE((SELECT jumlah_panggilan FROM kuota_demo WHERE alamat_ip = ? AND tanggal = ?), 0) AS milik,
            COALESCE((SELECT SUM(jumlah_panggilan) FROM kuota_demo WHERE tanggal = ?), 0) AS total`,
    args: [ip, tanggal, tanggal],
  });
  const milik = Number(rows[0].milik);
  const total = Number(rows[0].total);
  return total >= batas ? 0 : Math.max(0, KUOTA_PER_IP - milik);
}

/**
 * Pakai satu kuota. Satu perintah SQL saja, jadi aman walau ada request bersamaan:
 * baris baru/tambahan hanya terjadi kalau kuota IP dan total harian masih tersisa.
 */
export async function pakaiKuota(db: Client, ip: string, tanggal: string, batas = batasHarian()): Promise<boolean> {
  const res = await db.execute({
    sql: `INSERT INTO kuota_demo (alamat_ip, tanggal, jumlah_panggilan)
          SELECT ?, ?, 1
          WHERE (SELECT COALESCE(SUM(jumlah_panggilan), 0) FROM kuota_demo WHERE tanggal = ?) < ?
          ON CONFLICT (alamat_ip, tanggal) DO UPDATE SET jumlah_panggilan = jumlah_panggilan + 1
          WHERE kuota_demo.jumlah_panggilan < ?`,
    args: [ip, tanggal, tanggal, batas, KUOTA_PER_IP],
  });
  return res.rowsAffected > 0;
}

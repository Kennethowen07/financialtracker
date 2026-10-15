import type { Client } from "@libsql/client";
import type { JenisBerkategori } from "./kategori-bawaan";
import type { Jenis } from "./parser";

export interface Kategori {
  id: number;
  nama: string;
  jenis: JenisBerkategori;
  ikon: string;
  buatanPengguna: boolean;
}

/** Kategori bawaan (milik semua akun) + kategori "ketik sendiri" milik akun ini. */
export async function daftarKategori(client: Client, penggunaId: number): Promise<Kategori[]> {
  const { rows } = await client.execute({
    sql: `SELECT id, nama, jenis, ikon, buatan_pengguna FROM kategori
          WHERE pengguna_id IS NULL OR pengguna_id = ? ORDER BY id`,
    args: [penggunaId],
  });
  return rows.map((r) => ({
    id: Number(r.id),
    nama: String(r.nama),
    jenis: r.jenis as JenisBerkategori,
    ikon: String(r.ikon),
    buatanPengguna: Number(r.buatan_pengguna) === 1,
  }));
}

export class KesalahanInput extends Error {}

/**
 * Menentukan id kategori untuk sebuah jenis transaksi.
 * - Usaha → selalu null (tidak punya kategori).
 * - kategoriBaru → dipakai kalau namanya sudah ada (bawaan atau milik sendiri), kalau belum dibuat.
 * - kategoriId → harus ada, boleh dipakai akun ini, dan jenisnya cocok.
 */
export async function tentukanKategori(
  client: Client,
  penggunaId: number,
  jenis: Jenis,
  pilihan: { kategoriId?: number | null; kategoriBaru?: string | null },
): Promise<number | null> {
  if (jenis === "usaha") return null;

  const baru = pilihan.kategoriBaru?.trim().replace(/\s+/g, " ");
  if (baru) {
    if (baru.length > 40) throw new KesalahanInput("Nama kategori maksimal 40 karakter");
    const { rows } = await client.execute({
      sql: `SELECT id FROM kategori
            WHERE lower(nama) = lower(?) AND jenis = ? AND (pengguna_id IS NULL OR pengguna_id = ?)
            ORDER BY pengguna_id IS NOT NULL LIMIT 1`,
      args: [baru, jenis, penggunaId],
    });
    if (rows[0]) return Number(rows[0].id);
    const res = await client.execute({
      sql: "INSERT INTO kategori (nama, jenis, ikon, buatan_pengguna, pengguna_id) VALUES (?, ?, 'lainnya', 1, ?)",
      args: [baru, jenis, penggunaId],
    });
    return Number(res.lastInsertRowid);
  }

  if (pilihan.kategoriId == null) throw new KesalahanInput("Kategori wajib dipilih");
  const { rows } = await client.execute({
    sql: "SELECT jenis FROM kategori WHERE id = ? AND (pengguna_id IS NULL OR pengguna_id = ?)",
    args: [pilihan.kategoriId, penggunaId],
  });
  if (!rows[0]) throw new KesalahanInput("Kategori tidak ditemukan");
  if (rows[0].jenis !== jenis) throw new KesalahanInput("Kategori tidak cocok dengan jenis transaksi");
  return pilihan.kategoriId;
}

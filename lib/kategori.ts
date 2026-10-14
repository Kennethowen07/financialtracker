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

export async function daftarKategori(client: Client): Promise<Kategori[]> {
  const { rows } = await client.execute("SELECT id, nama, jenis, ikon, buatan_pengguna FROM kategori ORDER BY id");
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
 * - kategoriBaru → dibuat dulu (opsi "ketik sendiri"), atau dipakai kalau namanya sudah ada.
 * - kategoriId → harus ada dan jenisnya cocok.
 */
export async function tentukanKategori(
  client: Client,
  jenis: Jenis,
  pilihan: { kategoriId?: number | null; kategoriBaru?: string | null },
): Promise<number | null> {
  if (jenis === "usaha") return null;

  const baru = pilihan.kategoriBaru?.trim().replace(/\s+/g, " ");
  if (baru) {
    if (baru.length > 40) throw new KesalahanInput("Nama kategori maksimal 40 karakter");
    await client.execute({
      sql: "INSERT OR IGNORE INTO kategori (nama, jenis, ikon, buatan_pengguna) VALUES (?, ?, 'lainnya', 1)",
      args: [baru, jenis],
    });
    const { rows } = await client.execute({
      sql: "SELECT id FROM kategori WHERE nama = ? AND jenis = ?",
      args: [baru, jenis],
    });
    return Number(rows[0].id);
  }

  if (pilihan.kategoriId == null) throw new KesalahanInput("Kategori wajib dipilih");
  const { rows } = await client.execute({
    sql: "SELECT jenis FROM kategori WHERE id = ?",
    args: [pilihan.kategoriId],
  });
  if (!rows[0]) throw new KesalahanInput("Kategori tidak ditemukan");
  if (rows[0].jenis !== jenis) throw new KesalahanInput("Kategori tidak cocok dengan jenis transaksi");
  return pilihan.kategoriId;
}

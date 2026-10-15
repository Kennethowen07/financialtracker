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

// Kategori yang boleh dipakai satu akun: bawaan (tanpa pemilik) + buatannya sendiri.
// "buatan_pengguna = 0" penting: kategori "ketik sendiri" dari sebelum ada akun juga belum
// punya pemilik (sampai admin login), dan tidak boleh terlihat oleh akun lain.
const BOLEH_DIPAKAI = "((pengguna_id IS NULL AND buatan_pengguna = 0) OR pengguna_id = ?)";

/** Kategori bawaan (milik semua akun) + kategori "ketik sendiri" milik akun ini. */
export async function daftarKategori(client: Client, penggunaId: number): Promise<Kategori[]> {
  const { rows } = await client.execute({
    sql: `SELECT id, nama, jenis, ikon, buatan_pengguna FROM kategori
          WHERE ${BOLEH_DIPAKAI} ORDER BY id`,
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
    const cari = async () =>
      (await client.execute({
        sql: `SELECT id FROM kategori
              WHERE lower(nama) = lower(?) AND jenis = ? AND ${BOLEH_DIPAKAI}
              ORDER BY pengguna_id IS NOT NULL LIMIT 1`,
        args: [baru, jenis, penggunaId],
      })).rows[0];
    const ada = await cari();
    if (ada) return Number(ada.id);
    // "OR IGNORE": kalau dua request membuat kategori yang sama bersamaan, yang kedua cukup
    // memakai kategori yang baru dibuat yang pertama (dicari ulang di bawah).
    await client.execute({
      sql: "INSERT OR IGNORE INTO kategori (nama, jenis, ikon, buatan_pengguna, pengguna_id) VALUES (?, ?, 'lainnya', 1, ?)",
      args: [baru, jenis, penggunaId],
    });
    const dibuat = await cari();
    if (!dibuat) throw new Error("Kategori baru gagal dibuat");
    return Number(dibuat.id);
  }

  if (pilihan.kategoriId == null) throw new KesalahanInput("Kategori wajib dipilih");
  const { rows } = await client.execute({
    sql: `SELECT jenis FROM kategori WHERE id = ? AND ${BOLEH_DIPAKAI}`,
    args: [pilihan.kategoriId, penggunaId],
  });
  if (!rows[0]) throw new KesalahanInput("Kategori tidak ditemukan");
  if (rows[0].jenis !== jenis) throw new KesalahanInput("Kategori tidak cocok dengan jenis transaksi");
  return pilihan.kategoriId;
}

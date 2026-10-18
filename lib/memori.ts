// Memori = deskripsi yang pernah diajarkan beserta jenis & kategorinya.
// Dicek sebelum AI, jadi input yang sudah dikenal tidak memanggil AI sama sekali.
// Aturan pencocokan: docs/KEPUTUSAN.md no. 3.
import type { Client } from "@libsql/client";
import type { Jenis } from "./parser";

export type AsalMemori = "tanya_balik" | "koreksi" | "manual" | "ai" | "import";

export interface EntriMemori {
  id: number;
  kataKunci: string;
  jenis: Jenis;
  kategoriId: number | null;
}

export interface CocokMemori extends EntriMemori {
  cara: "persis" | "mirip";
}

/** Huruf kecil, tanda baca dibuang (kecuali &), spasi dirapikan. "Bakmi  Effata!" → "bakmi effata" */
export function normalisasi(teks: string): string {
  return teks
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}&\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jumlah huruf yang harus diubah/ditambah/dihapus supaya a menjadi b. Berhenti lebih awal kalau > batas. */
export function jarakEdit(a: string, b: string, batas = Infinity): number {
  if (Math.abs(a.length - b.length) > batas) return batas + 1;
  let sebelum = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const kini = [i];
    let minBaris = i;
    for (let j = 1; j <= b.length; j++) {
      const ganti = a[i - 1] === b[j - 1] ? 0 : 1;
      kini[j] = Math.min(sebelum[j] + 1, kini[j - 1] + 1, sebelum[j - 1] + ganti);
      minBaris = Math.min(minBaris, kini[j]);
    }
    if (minBaris > batas) return batas + 1;
    sebelum = kini;
  }
  return sebelum[b.length];
}

/** Toleransi typo berdasarkan panjang deskripsi (tanpa spasi). */
export function toleransiTypo(kataKunci: string): number {
  const panjang = kataKunci.replace(/\s/g, "").length;
  if (panjang < 5) return 0;
  if (panjang <= 8) return 1;
  return 2;
}

/**
 * Cari entri yang cocok di daftar memori. Persis dulu, lalu yang mirip.
 * Kalau ada beberapa entri mirip dengan jarak sama tapi kategorinya beda → tidak dianggap cocok
 * (lebih aman tanya balik daripada menebak).
 */
export function cocokkan(deskripsi: string, daftar: EntriMemori[]): CocokMemori | null {
  const kunci = normalisasi(deskripsi);
  if (!kunci) return null;

  const persis = daftar.find((e) => e.kataKunci === kunci);
  if (persis) return { ...persis, cara: "persis" };

  const batas = toleransiTypo(kunci);
  if (batas === 0) return null;

  let terbaik: EntriMemori[] = [];
  let jarakTerbaik = batas + 1;
  for (const e of daftar) {
    if (toleransiTypo(e.kataKunci) === 0) continue; // kata kunci pendek harus persis
    const jarak = jarakEdit(kunci, e.kataKunci, batas);
    if (jarak > batas) continue;
    if (jarak < jarakTerbaik) {
      jarakTerbaik = jarak;
      terbaik = [e];
    } else if (jarak === jarakTerbaik) {
      terbaik.push(e);
    }
  }
  if (terbaik.length === 0) return null;
  const sama = terbaik.every((e) => e.jenis === terbaik[0].jenis && e.kategoriId === terbaik[0].kategoriId);
  return sama ? { ...terbaik[0], cara: "mirip" } : null;
}

// ---------- akses database ----------

function keEntri(row: Record<string, unknown>): EntriMemori {
  return {
    id: Number(row.id),
    kataKunci: String(row.kata_kunci),
    jenis: row.jenis as Jenis,
    kategoriId: row.kategori_id == null ? null : Number(row.kategori_id),
  };
}

// Setiap akun punya memorinya sendiri, jadi semua query difilter pengguna_id.

export async function semuaMemori(client: Client, penggunaId: number): Promise<EntriMemori[]> {
  const { rows } = await client.execute({
    sql: "SELECT id, kata_kunci, jenis, kategori_id FROM memori WHERE pengguna_id = ?",
    args: [penggunaId],
  });
  return rows.map((r) => keEntri(r as Record<string, unknown>));
}

/** Cari di memori database. Persis lewat index dulu, baru pencocokan typo di semua entri. */
export async function cariMemori(client: Client, penggunaId: number, deskripsi: string): Promise<CocokMemori | null> {
  const kunci = normalisasi(deskripsi);
  if (!kunci) return null;
  const { rows } = await client.execute({
    sql: "SELECT id, kata_kunci, jenis, kategori_id FROM memori WHERE pengguna_id = ? AND kata_kunci = ?",
    args: [penggunaId, kunci],
  });
  if (rows[0]) return { ...keEntri(rows[0] as Record<string, unknown>), cara: "persis" };
  return cocokkan(kunci, await semuaMemori(client, penggunaId));
}

export async function tandaiDipakai(client: Client, id: number, waktu = new Date()): Promise<void> {
  await client.execute({
    sql: "UPDATE memori SET terakhir_dipakai = ? WHERE id = ?",
    args: [waktu.toISOString(), id],
  });
}

/** Simpan atau perbarui memori untuk satu deskripsi. */
export async function simpanMemori(
  client: Client,
  penggunaId: number,
  data: { deskripsi: string; jenis: Jenis; kategoriId: number | null; asal: AsalMemori },
  waktu = new Date(),
): Promise<void> {
  const kunci = normalisasi(data.deskripsi);
  if (!kunci) return;
  await client.execute({
    sql: `INSERT INTO memori (pengguna_id, kata_kunci, jenis, kategori_id, asal, terakhir_dipakai)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (pengguna_id, kata_kunci) DO UPDATE SET
            jenis = excluded.jenis,
            kategori_id = excluded.kategori_id,
            asal = excluded.asal,
            terakhir_dipakai = excluded.terakhir_dipakai`,
    args: [penggunaId, kunci, data.jenis, data.jenis === "usaha" ? null : data.kategoriId, data.asal, waktu.toISOString()],
  });
}


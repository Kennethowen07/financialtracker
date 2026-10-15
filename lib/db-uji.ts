// Database kosong di memori untuk test. Tiap panggilan = database baru yang terpisah.
import { createClient, type Client } from "@libsql/client";
import { masuk, type Pengguna } from "./akun";
import { siapkanDatabase } from "./skema";

export async function buatDbUji(): Promise<Client> {
  const client = createClient({ url: ":memory:" });
  await siapkanDatabase(client);
  return client;
}

/** Buat akun untuk test, kembalikan id-nya. */
export async function buatPenggunaUji(client: Client, email = "andi@uji.id"): Promise<number> {
  const waktu = new Date("2026-10-01T00:00:00Z").toISOString();
  const res = await client.execute({
    sql: "INSERT INTO pengguna (email, nama, dibuat_pada, terakhir_masuk) VALUES (?, ?, ?, ?)",
    args: [email, email.split("@")[0], waktu, waktu],
  });
  return Number(res.lastInsertRowid);
}

export async function idKategori(client: Client, nama: string): Promise<number> {
  const { rows } = await client.execute({ sql: "SELECT id FROM kategori WHERE nama = ?", args: [nama] });
  if (!rows[0]) throw new Error(`Kategori ${nama} tidak ada`);
  return Number(rows[0].id);
}

/** Login yang diharapkan berhasil (test gagal kalau hasilnya "nonaktif"/"bentrok"). */
export async function masukUji(...args: Parameters<typeof masuk>): Promise<Pengguna> {
  const hasil = await masuk(...args);
  if (typeof hasil === "string") throw new Error(`login gagal: ${hasil}`);
  return hasil;
}

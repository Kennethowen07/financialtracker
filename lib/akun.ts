// Akun pengguna. Siapa pun bisa daftar lewat Google (pendaftaran terbuka).
// Admin = akun dengan email yang sama dengan ADMIN_EMAIL. Admin bisa melihat daftar akun dan
// menonaktifkannya, tapi tidak bisa melihat transaksi akun lain.
import type { Client } from "@libsql/client";

export interface Pengguna {
  id: number;
  email: string;
  nama: string;
  admin: boolean;
  aktif: boolean;
}

/** Yang ditampilkan di layar (sidebar, halaman akun). Aman dikirim ke browser. */
export type InfoAkun = Pick<Pengguna, "nama" | "email" | "admin">;

export function emailAdmin(): string {
  return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
}

function kePengguna(r: Record<string, unknown>, admin: string): Pengguna {
  const email = String(r.email);
  return {
    id: Number(r.id),
    email,
    nama: String(r.nama),
    admin: Boolean(admin) && email === admin,
    aktif: Number(r.aktif) === 1,
  };
}

export async function ambilPengguna(db: Client, id: number, admin = emailAdmin()): Promise<Pengguna | null> {
  const { rows } = await db.execute({ sql: "SELECT id, email, nama, aktif FROM pengguna WHERE id = ?", args: [id] });
  return rows[0] ? kePengguna(rows[0] as Record<string, unknown>, admin) : null;
}

export interface ProfilMasuk {
  email: string;
  nama: string;
  /** Kosong untuk login developer di laptop. */
  googleId?: string | null;
}

/**
 * Dipanggil setiap kali seseorang berhasil login. Membuat akun baru kalau belum ada.
 * Mengembalikan null kalau akunnya sudah dinonaktifkan admin.
 */
export async function masuk(db: Client, profil: ProfilMasuk, sekarang = new Date(), admin = emailAdmin()): Promise<Pengguna | null> {
  const email = profil.email.trim().toLowerCase();
  const nama = profil.nama.trim().slice(0, 80) || email.split("@")[0];
  const googleId = profil.googleId || null;
  const waktu = sekarang.toISOString();

  // Cari lewat id Google dulu (tetap sama walau email diganti), lalu lewat email.
  let lama = googleId
    ? (await db.execute({ sql: "SELECT id, aktif FROM pengguna WHERE google_id = ?", args: [googleId] })).rows[0]
    : undefined;
  lama ??= (await db.execute({ sql: "SELECT id, aktif FROM pengguna WHERE email = ?", args: [email] })).rows[0];

  let id: number;
  if (lama) {
    if (Number(lama.aktif) !== 1) return null;
    id = Number(lama.id);
    await db.execute({
      sql: `UPDATE pengguna SET email = ?, nama = ?, google_id = COALESCE(google_id, ?), terakhir_masuk = ? WHERE id = ?`,
      args: [email, nama, googleId, waktu, id],
    });
  } else {
    const res = await db.execute({
      sql: `INSERT INTO pengguna (google_id, email, nama, dibuat_pada, terakhir_masuk) VALUES (?, ?, ?, ?, ?)`,
      args: [googleId, email, nama, waktu, waktu],
    });
    id = Number(res.lastInsertRowid);
  }

  if (admin && email === admin) await klaimDataLama(db, id);
  return ambilPengguna(db, id, admin);
}

/**
 * Data dari sebelum ada akun (pengguna_id NULL) dipindahkan ke akun admin.
 * "OR IGNORE": kalau admin sudah punya memori/analisis yang sama, yang lama dilewati.
 */
export async function klaimDataLama(db: Client, penggunaId: number): Promise<void> {
  await db.batch(
    [
      { sql: "UPDATE transaksi SET pengguna_id = ? WHERE pengguna_id IS NULL", args: [penggunaId] },
      { sql: "UPDATE OR IGNORE memori SET pengguna_id = ? WHERE pengguna_id IS NULL", args: [penggunaId] },
      { sql: "UPDATE OR IGNORE analisis SET pengguna_id = ? WHERE pengguna_id IS NULL", args: [penggunaId] },
      {
        sql: "UPDATE OR IGNORE kategori SET pengguna_id = ? WHERE pengguna_id IS NULL AND buatan_pengguna = 1",
        args: [penggunaId],
      },
    ],
    "write",
  );
}

export interface BarisPengguna extends Pengguna {
  dibuatPada: string;
  terakhirMasuk: string;
  jumlahTransaksi: number;
}

/** Untuk halaman admin: daftar akun beserta jumlah transaksinya (isinya tidak ikut). */
export async function daftarPengguna(db: Client, admin = emailAdmin()): Promise<BarisPengguna[]> {
  const { rows } = await db.execute(`
    SELECT p.id, p.email, p.nama, p.aktif, p.dibuat_pada, p.terakhir_masuk,
           (SELECT COUNT(*) FROM transaksi t WHERE t.pengguna_id = p.id) AS jumlah_transaksi
    FROM pengguna p ORDER BY p.dibuat_pada`);
  return rows.map((r) => ({
    ...kePengguna(r as Record<string, unknown>, admin),
    dibuatPada: String(r.dibuat_pada),
    terakhirMasuk: String(r.terakhir_masuk),
    jumlahTransaksi: Number(r.jumlah_transaksi),
  }));
}

export async function aturAktif(db: Client, id: number, aktif: boolean): Promise<boolean> {
  const res = await db.execute({ sql: "UPDATE pengguna SET aktif = ? WHERE id = ?", args: [aktif ? 1 : 0, id] });
  return res.rowsAffected > 0;
}

// Bantuan bersama untuk Route Handler di app/api dan halaman server.
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { buatLayananGemini, denganKuota, type LayananAI } from "./ai";
import { ambilPengguna, type Pengguna } from "./akun";
import { db } from "./db";
import { KesalahanInput } from "./kategori";
import { pakaiKuotaPengguna } from "./kuota";
import { bacaToken, buatToken, NAMA_COOKIE, UMUR_SESI_DETIK } from "./sesi";
import { hariIni } from "./tanggal";
import type { Deps } from "./transaksi";

let ai: LayananAI | null = null;

/** Satu layanan Gemini untuk seluruh server. */
export function layananAI(): LayananAI {
  ai ??= buatLayananGemini();
  return ai;
}

/** Akun yang sedang login (dari cookie sesi), atau null kalau belum login / dinonaktifkan. */
export async function penggunaSaatIni(): Promise<Pengguna | null> {
  const id = await bacaToken((await cookies()).get(NAMA_COOKIE)?.value);
  if (id === null) return null;
  const pengguna = await ambilPengguna(db, id);
  return pengguna?.aktif ? pengguna : null;
}

/** Database + AI atas nama satu akun. Akun biasa memakai kuota AI harian, admin tidak. */
export function deps(pengguna: Pengguna): Deps {
  const ai = pengguna.admin
    ? layananAI()
    : denganKuota(layananAI(), () => pakaiKuotaPengguna(db, pengguna.id, hariIni()));
  return { db, ai, penggunaId: pengguna.id };
}

/**
 * Pola semua API pribadi: pastikan sudah login, jalankan aksinya, dan ubah error jadi respons.
 *   export async function GET() { return denganPengguna(async (p) => Response.json(...)); }
 */
export async function denganPengguna(aksi: (pengguna: Pengguna) => Promise<Response>): Promise<Response> {
  try {
    const pengguna = await penggunaSaatIni();
    if (!pengguna) return Response.json({ error: "Belum masuk" }, { status: 401 });
    return await aksi(pengguna);
  } catch (err) {
    return tanganiError(err);
  }
}

/** Pasang cookie sesi setelah login berhasil. */
export async function pasangSesi(res: NextResponse, penggunaId: number): Promise<NextResponse> {
  res.cookies.set(NAMA_COOKIE, await buatToken(penggunaId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UMUR_SESI_DETIK,
  });
  return res;
}

/** Baca body JSON; body rusak dianggap objek kosong (validasi menangani sisanya). */
export async function bacaJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function idDariParam(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

/** Error input → 400 dengan pesan; error lain → 500 tanpa membocorkan detail. */
export function tanganiError(err: unknown): Response {
  if (err instanceof KesalahanInput) return Response.json({ error: err.message }, { status: 400 });
  console.error("[api]", err);
  return Response.json({ error: "Terjadi kesalahan di server" }, { status: 500 });
}

export const POLA_BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;

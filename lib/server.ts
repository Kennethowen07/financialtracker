// Bantuan bersama untuk Route Handler di app/api.
import { buatLayananGemini, type LayananAI } from "./ai";
import { db } from "./db";
import { KesalahanInput } from "./kategori";
import type { Deps } from "./transaksi";

let ai: LayananAI | null = null;

/** Koneksi database + layanan AI yang dipakai semua API. */
export function deps(): Deps {
  ai ??= buatLayananGemini();
  return { db, ai };
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

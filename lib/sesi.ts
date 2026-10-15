// Sesi login: cookie berisi id pengguna + waktu kedaluwarsa, ditandatangani HMAC supaya
// tidak bisa dipalsukan. Memakai Web Crypto supaya jalan di proxy maupun Route Handler.
import { dariBase64Url, keBase64Url } from "./base64url";

export const NAMA_COOKIE = "fd_sesi";
export const UMUR_SESI_DETIK = 60 * 60 * 24 * 30; // 30 hari

const enc = new TextEncoder();

/**
 * Kunci tanda tangan dari SESSION_SECRET. Di laptop (development) boleh kosong dan memakai
 * kunci bawaan. Di production wajib diisi: tanpa kunci, tidak ada token yang dianggap sah.
 */
export function rahasiaSesi(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return process.env.NODE_ENV === "production" ? "" : "kunci-khusus-development";
}

async function kunciHmac(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Token "idPengguna.kedaluwarsa.tandaTangan". */
export async function buatToken(penggunaId: number, sekarangMs = Date.now(), secret = rahasiaSesi()): Promise<string> {
  if (!secret) throw new Error("SESSION_SECRET belum diisi");
  const isi = `${penggunaId}.${Math.floor(sekarangMs / 1000) + UMUR_SESI_DETIK}`;
  const tanda = await crypto.subtle.sign("HMAC", await kunciHmac(secret), enc.encode(isi));
  return `${isi}.${keBase64Url(tanda)}`;
}

/** Id pengguna kalau token sah dan belum kedaluwarsa, selain itu null. */
export async function bacaToken(token: string | undefined, sekarangMs = Date.now(), secret = rahasiaSesi()): Promise<number | null> {
  if (!token || !secret) return null;
  const [id, kedaluwarsa, tanda] = token.split(".");
  if (!/^\d+$/.test(id ?? "") || !/^\d+$/.test(kedaluwarsa ?? "")) return null;
  if (Number(kedaluwarsa) * 1000 < sekarangMs) return null;
  const byte = dariBase64Url(tanda ?? "");
  if (!byte) return null;
  // verify() membandingkan dalam waktu konstan.
  const sah = await crypto.subtle.verify("HMAC", await kunciHmac(secret), byte, enc.encode(`${id}.${kedaluwarsa}`));
  return sah ? Number(id) : null;
}

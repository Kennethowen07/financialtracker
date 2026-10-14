// Login satu akun pribadi (docs/KEPUTUSAN.md no. 5): satu password di environment
// variable + cookie sesi yang ditandatangani HMAC. Memakai Web Crypto supaya jalan
// di proxy maupun Route Handler.

export const NAMA_COOKIE = "fd_sesi";
export const UMUR_SESI_DETIK = 60 * 60 * 24 * 30; // 30 hari

const enc = new TextEncoder();

/** Login aktif kalau APP_PASSWORD diisi. */
export function loginAktif(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/** Kunci tanda tangan: SESSION_SECRET, atau APP_PASSWORD kalau tidak diisi. */
function rahasia(): string {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "";
}

async function kunciHmac(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function keBase64Url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function dariBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const biner = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(biner, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Token "kedaluwarsa.tandaTangan". */
export async function buatToken(sekarangMs = Date.now(), secret = rahasia()): Promise<string> {
  const kedaluwarsa = String(Math.floor(sekarangMs / 1000) + UMUR_SESI_DETIK);
  const tanda = await crypto.subtle.sign("HMAC", await kunciHmac(secret), enc.encode(kedaluwarsa));
  return `${kedaluwarsa}.${keBase64Url(tanda)}`;
}

export async function tokenSah(token: string | undefined, sekarangMs = Date.now(), secret = rahasia()): Promise<boolean> {
  if (!token || !secret) return false;
  const [kedaluwarsa, tanda] = token.split(".");
  if (!/^\d+$/.test(kedaluwarsa ?? "") || Number(kedaluwarsa) * 1000 < sekarangMs) return false;
  const byte = dariBase64Url(tanda ?? "");
  if (!byte) return false;
  // verify() membandingkan dalam waktu konstan.
  return crypto.subtle.verify("HMAC", await kunciHmac(secret), byte, enc.encode(kedaluwarsa));
}

/** Bandingkan password lewat HMAC keduanya, supaya waktu proses tidak membocorkan isinya. */
export async function passwordCocok(masukan: string, benar = process.env.APP_PASSWORD ?? ""): Promise<boolean> {
  if (!benar) return false;
  const k = await kunciHmac("pembanding-password");
  const tandaBenar = await crypto.subtle.sign("HMAC", k, enc.encode(benar));
  return crypto.subtle.verify("HMAC", k, tandaBenar, enc.encode(masukan));
}

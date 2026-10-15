// Login dengan Google (OAuth 2.0 / OpenID Connect, alur "authorization code" + PKCE).
//
// 1. /api/auth/google            → arahkan ke halaman pilih akun Google
// 2. Google mengembalikan ke      /api/auth/google/callback?code=...&state=...
// 3. Server menukar code dengan id_token langsung ke Google, lalu membaca email & nama.
//
// Karena id_token diterima langsung dari server Google lewat HTTPS (bukan lewat browser),
// isinya boleh dipercaya tanpa memeriksa tanda tangannya (OpenID Connect Core 3.1.3.7).
// Yang tetap dicek: penerbit, client id, waktu kedaluwarsa, dan email sudah diverifikasi.
import { dariBase64Url, keBase64Url } from "./base64url";

const URL_MASUK = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_TOKEN = "https://oauth2.googleapis.com/token";
const PENERBIT = ["https://accounts.google.com", "accounts.google.com"];

export const COOKIE_OAUTH = "fd_oauth";

export interface ProfilGoogle {
  googleId: string;
  email: string;
  nama: string;
}

export function googleAktif(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** PKCE: Google hanya mau menukar code kalau kita bisa menunjukkan verifier aslinya. */
export async function tantanganPkce(verifier: string): Promise<string> {
  return keBase64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

export function urlMasukGoogle(opsi: { redirectUri: string; state: string; tantangan: string }): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: opsi.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opsi.state,
    code_challenge: opsi.tantangan,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${URL_MASUK}?${q}`;
}

/** Tukar code dari Google dengan id_token. Melempar error kalau Google menolak. */
export async function tukarKode(opsi: { code: string; redirectUri: string; verifier: string }): Promise<string> {
  const res = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: opsi.code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: opsi.redirectUri,
      grant_type: "authorization_code",
      code_verifier: opsi.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !data.id_token) throw new Error(`Google menolak: ${data.error ?? res.status}`);
  return data.id_token;
}

/** Baca isi id_token dan periksa. null kalau tidak sah. */
export function periksaIdToken(idToken: string, clientId: string, sekarangMs = Date.now()): ProfilGoogle | null {
  const bagian = idToken.split(".");
  if (bagian.length !== 3) return null;
  const byte = dariBase64Url(bagian[1]);
  if (!byte) return null;

  let isi: Record<string, unknown>;
  try {
    isi = JSON.parse(new TextDecoder().decode(byte));
  } catch {
    return null;
  }

  if (!PENERBIT.includes(String(isi.iss))) return null;
  if (!clientId || isi.aud !== clientId) return null;
  if (typeof isi.exp !== "number" || isi.exp * 1000 < sekarangMs) return null;
  if (isi.email_verified !== true && isi.email_verified !== "true") return null;
  if (typeof isi.sub !== "string" || typeof isi.email !== "string" || !isi.sub || !isi.email) return null;

  const email = isi.email.toLowerCase();
  const nama = typeof isi.name === "string" && isi.name.trim() ? isi.name.trim() : email.split("@")[0];
  return { googleId: isi.sub, email, nama };
}

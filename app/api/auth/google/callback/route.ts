// GET /api/auth/google/callback?code=...&state=... (Google mengarahkan ke sini setelah memilih akun)
import { NextResponse, type NextRequest } from "next/server";
import { masuk } from "@/lib/akun";
import { db } from "@/lib/db";
import { COOKIE_OAUTH, periksaIdToken, tukarKode } from "@/lib/google";
import { pasangSesi } from "@/lib/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const [state, verifier] = (request.cookies.get(COOKIE_OAUTH)?.value ?? "").split(".");

  const ke = (tujuan: string) => {
    const res = NextResponse.redirect(new URL(tujuan, request.url));
    res.cookies.delete({ name: COOKIE_OAUTH, path: "/api/auth/google" });
    return res;
  };

  if (q.get("error")) return ke("/masuk?galat=dibatalkan");
  const code = q.get("code");
  if (!code || !state || !verifier || q.get("state") !== state) return ke("/masuk?galat=gagal");

  try {
    const idToken = await tukarKode({ code, verifier, redirectUri: `${request.nextUrl.origin}/api/auth/google/callback` });
    const profil = periksaIdToken(idToken, process.env.GOOGLE_CLIENT_ID ?? "");
    if (!profil) return ke("/masuk?galat=gagal");

    const pengguna = await masuk(db, profil);
    if (!pengguna) return ke("/masuk?galat=nonaktif");
    return pasangSesi(ke("/"), pengguna.id);
  } catch (err) {
    console.error("[auth] login Google gagal:", err instanceof Error ? err.message : err);
    return ke("/masuk?galat=gagal");
  }
}

// GET /api/auth/google → arahkan ke halaman pilih akun Google.
// state (anti-pemalsuan) dan verifier PKCE disimpan sebentar di cookie, dicek lagi di callback.
import { NextResponse, type NextRequest } from "next/server";
import { acak } from "@/lib/base64url";
import { COOKIE_OAUTH, googleAktif, tantanganPkce, urlMasukGoogle } from "@/lib/google";

export async function GET(request: NextRequest) {
  if (!googleAktif()) return NextResponse.redirect(new URL("/masuk?galat=belum_diatur", request.url));

  const state = acak();
  const verifier = acak();
  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;
  const res = NextResponse.redirect(urlMasukGoogle({ redirectUri, state, tantangan: await tantanganPkce(verifier) }));
  res.cookies.set(COOKIE_OAUTH, `${state}.${verifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}

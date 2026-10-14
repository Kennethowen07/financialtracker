import { NextResponse } from "next/server";
import { bacaJson } from "@/lib/server";
import { buatToken, loginAktif, NAMA_COOKIE, passwordCocok, UMUR_SESI_DETIK } from "@/lib/sesi";

// POST /api/masuk  { password }
export async function POST(request: Request) {
  if (!loginAktif()) return NextResponse.json({ error: "Login belum diatur (APP_PASSWORD kosong)" }, { status: 400 });
  const { password } = await bacaJson(request);
  if (typeof password !== "string" || !(await passwordCocok(password))) {
    // Jeda kecil supaya tebak-tebakan password jadi lambat.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Password salah" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NAMA_COOKIE, await buatToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UMUR_SESI_DETIK,
  });
  return res;
}

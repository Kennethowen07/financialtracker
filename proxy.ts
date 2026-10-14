// Proxy (dulu "middleware"): jalan sebelum setiap request.
// Melindungi data pribadi. Yang terbuka tanpa login: /masuk, /demo, API demo, ikon & manifest PWA.
import { NextResponse, type NextRequest } from "next/server";
import { loginAktif, NAMA_COOKIE, tokenSah } from "@/lib/sesi";

export async function proxy(request: NextRequest) {
  const api = request.nextUrl.pathname.startsWith("/api/");

  if (!loginAktif()) {
    // Development tanpa APP_PASSWORD: bebas, supaya mudah dicoba.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    // Production tanpa password: data pribadi ditutup total, arahkan ke demo.
    return api
      ? NextResponse.json({ error: "Login belum diatur (APP_PASSWORD kosong)" }, { status: 401 })
      : NextResponse.redirect(new URL("/demo", request.url));
  }

  if (await tokenSah(request.cookies.get(NAMA_COOKIE)?.value)) return NextResponse.next();

  if (api) return NextResponse.json({ error: "Belum masuk" }, { status: 401 });
  return NextResponse.redirect(new URL("/masuk", request.url));
}

export const config = {
  // Semua path kecuali yang publik. "/" (dashboard) ikut dilindungi.
  matcher: ["/((?!masuk|demo|api/masuk|api/demo|_next/|ikon/|icon|apple-icon|manifest.webmanifest|favicon.ico).*)"],
};

// Proxy (dulu "middleware"): jalan sebelum setiap request.
// Melindungi data pribadi. Yang terbuka tanpa login: /masuk, /demo, login Google, API demo,
// ikon & manifest PWA. Di sini hanya dicek tanda tangan cookie (cepat, tanpa database);
// akun yang dinonaktifkan dicek lagi di server (lib/server.ts).
import { NextResponse, type NextRequest } from "next/server";
import { bacaToken, NAMA_COOKIE } from "@/lib/sesi";

export async function proxy(request: NextRequest) {
  if ((await bacaToken(request.cookies.get(NAMA_COOKIE)?.value)) !== null) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Belum masuk" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/masuk", request.url));
}

export const config = {
  // Semua path kecuali yang publik. "/" (dashboard) ikut dilindungi.
  matcher: ["/((?!masuk|demo|api/auth|api/demo|_next/|ikon/|icon|apple-icon|manifest.webmanifest|favicon.ico).*)"],
};

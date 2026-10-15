// Proxy (dulu "middleware"): jalan sebelum setiap request.
// Melindungi data pribadi. Yang terbuka tanpa login: /masuk, /demo, login Google, API demo,
// ikon & manifest PWA. Di sini hanya dicek tanda tangan cookie (cepat, tanpa database);
// akun yang dinonaktifkan dicek lagi di server (lib/server.ts).
import { NextResponse, type NextRequest } from "next/server";
import { bacaToken, NAMA_COOKIE } from "@/lib/sesi";

// Dicocokkan per segmen: "/masuk" dan "/masuk/..." terbuka, tapi "/masukan" tidak.
const PUBLIK = /^\/(masuk|demo|api\/auth|api\/demo|ikon)(\/|$)|^\/(icon|apple-icon|manifest\.webmanifest|favicon\.ico)$/;

/**
 * Perlindungan CSRF: request yang mengubah data harus berasal dari situs ini sendiri.
 * Browser modern selalu mengirim Sec-Fetch-Site; kalau tidak ada (mis. curl), dibiarkan.
 */
function dariSitusLain(request: NextRequest): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const asal = request.headers.get("sec-fetch-site");
  return asal !== null && asal !== "same-origin" && asal !== "none";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (dariSitusLain(request)) return NextResponse.json({ error: "Ditolak" }, { status: 403 });
  if (PUBLIK.test(pathname)) return NextResponse.next();
  if ((await bacaToken(request.cookies.get(NAMA_COOKIE)?.value)) !== null) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Belum masuk" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/masuk", request.url));
}

export const config = {
  // Semua path kecuali file internal Next.js. Path publik dicek di atas (PUBLIK).
  matcher: ["/((?!_next/|__nextjs).*)"],
};

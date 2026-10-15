// Test untuk proxy.ts (di root project): siapa yang boleh lewat tanpa login, dan CSRF.
import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { buatToken, NAMA_COOKIE } from "./sesi";

function req(path: string, opsi: { method?: string; situs?: string; cookie?: string } = {}) {
  const headers = new Headers();
  if (opsi.situs) headers.set("sec-fetch-site", opsi.situs);
  if (opsi.cookie) headers.set("cookie", `${NAMA_COOKIE}=${opsi.cookie}`);
  return new NextRequest(new URL(path, "http://localhost:3000"), { method: opsi.method ?? "GET", headers });
}

const lewat = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("proxy", () => {
  test("halaman publik terbuka tanpa login", async () => {
    for (const path of ["/masuk", "/demo", "/privasi", "/api/auth/google", "/api/auth/google/callback", "/api/demo/catat", "/ikon/192", "/icon", "/manifest.webmanifest"]) {
      expect(lewat(await proxy(req(path))), path).toBe(true);
    }
  });

  test("path yang hanya mirip path publik tetap wajib login", async () => {
    const halaman = await proxy(req("/masukan"));
    expect(halaman.status).toBe(307);
    expect(halaman.headers.get("location")).toBe("http://localhost:3000/masuk");
    expect((await proxy(req("/api/authx"))).status).toBe(401);
    expect((await proxy(req("/demo-rahasia"))).status).toBe(307);
  });

  test("tanpa login: halaman diarahkan ke /masuk, API dijawab 401", async () => {
    expect((await proxy(req("/"))).status).toBe(307);
    expect((await proxy(req("/api/transaksi"))).status).toBe(401);
    expect((await proxy(req("/api/transaksi", { cookie: "1.9999999999.palsu" }))).status).toBe(401);
  });

  test("dengan cookie sesi yang sah: lewat", async () => {
    const token = await buatToken(1);
    expect(lewat(await proxy(req("/", { cookie: token })))).toBe(true);
    expect(lewat(await proxy(req("/api/catat", { method: "POST", situs: "same-origin", cookie: token })))).toBe(true);
  });

  test("POST dari situs lain ditolak walau cookie-nya sah (CSRF)", async () => {
    const token = await buatToken(1);
    expect((await proxy(req("/api/catat", { method: "POST", situs: "cross-site", cookie: token }))).status).toBe(403);
    expect((await proxy(req("/api/keluar", { method: "POST", situs: "same-site", cookie: token }))).status).toBe(403);
    expect((await proxy(req("/api/auth/dev", { method: "POST", situs: "cross-site" }))).status).toBe(403);
    // GET biasa dari situs lain (mis. klik tautan) tetap boleh.
    expect(lewat(await proxy(req("/", { situs: "cross-site", cookie: token })))).toBe(true);
  });
});

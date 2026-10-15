import type { NextRequest } from "next/server";
import { hariIni } from "@/lib/tanggal";
import { bacaJson, denganPengguna, deps, POLA_BULAN } from "@/lib/server";
import { daftarTransaksi, tambahManual, type TransaksiManual } from "@/lib/transaksi";

// GET /api/transaksi?bulan=2026-10
export async function GET(request: NextRequest) {
  return denganPengguna(async (pengguna) => {
    const bulan = request.nextUrl.searchParams.get("bulan") ?? hariIni().slice(0, 7);
    if (!POLA_BULAN.test(bulan)) return Response.json({ error: "Format bulan harus YYYY-MM" }, { status: 400 });
    const { db, penggunaId } = deps(pengguna);
    return Response.json(await daftarTransaksi(db, penggunaId, bulan));
  });
}

// POST /api/transaksi  (form manual)
export async function POST(request: Request) {
  return denganPengguna(async (pengguna) => {
    const body = await bacaJson(request);
    const trx = await tambahManual(deps(pengguna), body as unknown as TransaksiManual);
    return Response.json(trx, { status: 201 });
  });
}

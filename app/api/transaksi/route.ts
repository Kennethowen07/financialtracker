import type { NextRequest } from "next/server";
import { hariIni } from "@/lib/tanggal";
import { bacaJson, deps, POLA_BULAN, tanganiError } from "@/lib/server";
import { daftarTransaksi, tambahManual, type TransaksiManual } from "@/lib/transaksi";

// GET /api/transaksi?bulan=2026-10
export async function GET(request: NextRequest) {
  const bulan = request.nextUrl.searchParams.get("bulan") ?? hariIni().slice(0, 7);
  if (!POLA_BULAN.test(bulan)) return Response.json({ error: "Format bulan harus YYYY-MM" }, { status: 400 });
  try {
    return Response.json(await daftarTransaksi(deps().db, bulan));
  } catch (err) {
    return tanganiError(err);
  }
}

// POST /api/transaksi  (form manual)
export async function POST(request: Request) {
  const body = await bacaJson(request);
  try {
    const trx = await tambahManual(deps(), body as unknown as TransaksiManual);
    return Response.json(trx, { status: 201 });
  } catch (err) {
    return tanganiError(err);
  }
}

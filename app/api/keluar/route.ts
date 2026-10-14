import { NextResponse } from "next/server";
import { NAMA_COOKIE } from "@/lib/sesi";

// POST /api/keluar → hapus cookie sesi
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(NAMA_COOKIE);
  return res;
}

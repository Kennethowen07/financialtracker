// GET /api/demo/kuota → { sisa, aiAktif }
import { connection } from "next/server";
import { db } from "@/lib/db";
import { hashIp, sisaKuota } from "@/lib/kuota";
import { layananAI } from "@/lib/server";
import { hariIni } from "@/lib/tanggal";

export async function GET(request: Request) {
  await connection();
  if (!layananAI().aktif) return Response.json({ sisa: 0, aiAktif: false });
  const ip = await hashIp(request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "lokal");
  return Response.json({ sisa: await sisaKuota(db, ip, hariIni()), aiAktif: true });
}

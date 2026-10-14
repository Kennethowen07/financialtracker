// GET /api/demo/kuota → { sisa, aiAktif }
import { connection } from "next/server";
import { hashIp, sisaKuota } from "@/lib/kuota";
import { deps } from "@/lib/server";
import { hariIni } from "@/lib/tanggal";

export async function GET(request: Request) {
  await connection();
  const { db, ai } = deps();
  if (!ai.aktif) return Response.json({ sisa: 0, aiAktif: false });
  const ip = await hashIp(request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "lokal");
  return Response.json({ sisa: await sisaKuota(db, ip, hariIni()), aiAktif: true });
}

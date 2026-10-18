// POST /api/demo/suara  { teks: "rasela dua lima" }
// Satu-satunya pintu AI untuk mode demo: cadangan input suara saat nominal tidak terbaca.
// Mengurangi kuota demo (per IP per hari) hanya kalau benar-benar memanggil AI.
import { db } from "@/lib/db";
import { hashIp, pakaiKuota, sisaKuota } from "@/lib/kuota";
import { bacaJson, layananAI } from "@/lib/server";
import { hariIni } from "@/lib/tanggal";
import { rapikanSuara } from "@/lib/transaksi";

function alamatIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "lokal";
}

export async function POST(request: Request) {
  const body = await bacaJson(request);
  const teks = typeof body.teks === "string" ? body.teks.trim().slice(0, 500) : "";
  if (!teks) return Response.json({ error: "Teks kosong" }, { status: 400 });

  const ai = layananAI();
  const ip = await hashIp(alamatIp(request));
  const tanggal = hariIni();
  if (!ai.aktif) return Response.json({ ok: false, alasan: "tidak_tersedia", sisa: 0 });
  if (!(await pakaiKuota(db, ip, tanggal))) return Response.json({ ok: false, alasan: "kuota", sisa: 0 });

  const hasil = await rapikanSuara(ai, teks);
  return Response.json({ ...hasil, sisa: await sisaKuota(db, ip, tanggal) });
}

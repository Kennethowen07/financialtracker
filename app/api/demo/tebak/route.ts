// POST /api/demo/tebak  { deskripsi, contoh? }
// Satu-satunya pintu AI untuk mode demo. Mengurangi kuota hanya kalau benar-benar memanggil AI.
import { KATEGORI_BAWAAN } from "@/lib/kategori-bawaan";
import { db } from "@/lib/db";
import { hashIp, pakaiKuota, sisaKuota } from "@/lib/kuota";
import { bacaJson, layananAI } from "@/lib/server";
import { hariIni } from "@/lib/tanggal";

function alamatIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "lokal";
}

export async function POST(request: Request) {
  const body = await bacaJson(request);
  const deskripsi = typeof body.deskripsi === "string" ? body.deskripsi.trim().slice(0, 100) : "";
  if (!deskripsi) return Response.json({ error: "Deskripsi kosong" }, { status: 400 });
  const contoh = Array.isArray(body.contoh)
    ? body.contoh.slice(0, 5).map((c: Record<string, unknown>) => ({
        kataKunci: String(c?.kataKunci ?? "").slice(0, 100),
        jenis: String(c?.jenis ?? "").slice(0, 20),
        kategori: c?.kategori == null ? null : String(c.kategori).slice(0, 40),
      }))
    : [];

  const ai = layananAI();
  const ip = await hashIp(alamatIp(request));
  const tanggal = hariIni();
  if (!ai.aktif) return Response.json({ ok: false, alasan: "tidak_aktif", sisa: 0 });
  if (!(await pakaiKuota(db, ip, tanggal))) return Response.json({ ok: false, alasan: "kuota", sisa: 0 });

  const hasil = await ai.tebakKategori({
    deskripsi,
    kategori: KATEGORI_BAWAAN.map(({ nama, jenis }) => ({ nama, jenis })),
    contoh,
  });
  return Response.json({ ...hasil, sisa: await sisaKuota(db, ip, tanggal) });
}

import type { NextRequest } from "next/server";
import { ambilAnalisis, perbaruiAnalisis } from "@/lib/analisis";
import { bacaJson, denganPengguna, deps, POLA_BULAN } from "@/lib/server";

const PESAN: Record<string, { status: number; pesan: string }> = {
  tanpa_data: { status: 422, pesan: "Belum ada transaksi di bulan ini." },
  tidak_aktif: { status: 503, pesan: "AI belum aktif. Isi GEMINI_API_KEY di environment." },
  kuota: { status: 503, pesan: "Kuota AI sedang habis. Coba lagi nanti atau besok." },
  timeout: { status: 504, pesan: "AI terlalu lama menjawab. Coba lagi." },
  error: { status: 502, pesan: "AI sedang bermasalah. Coba lagi nanti." },
};

// GET /api/analisis?bulan=2026-10 → analisis tersimpan (atau null)
export async function GET(request: NextRequest) {
  return denganPengguna(async (pengguna) => {
    const bulan = request.nextUrl.searchParams.get("bulan") ?? "";
    if (!POLA_BULAN.test(bulan)) return Response.json({ error: "Format bulan harus YYYY-MM" }, { status: 400 });
    const { db, penggunaId } = deps(pengguna);
    return Response.json(await ambilAnalisis(db, penggunaId, bulan));
  });
}

// POST /api/analisis  { bulan: "2026-10" } → buat ulang lewat AI (tombol "Perbarui")
export async function POST(request: Request) {
  return denganPengguna(async (pengguna) => {
    const { bulan } = await bacaJson(request);
    if (typeof bulan !== "string" || !POLA_BULAN.test(bulan)) {
      return Response.json({ error: "Format bulan harus YYYY-MM" }, { status: 400 });
    }
    const hasil = await perbaruiAnalisis(deps(pengguna), bulan);
    if (hasil.ok) return Response.json(hasil.analisis);
    const { status, pesan } = PESAN[hasil.alasan];
    return Response.json({ error: pesan, alasan: hasil.alasan }, { status });
  });
}

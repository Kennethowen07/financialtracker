// POST /api/suara  { teks: "rasela dua lima" }
// Cadangan input suara: dipanggil hanya kalau parser tidak menemukan nominal di hasil suara.
// Yang dikirim ke Gemini hanya teks (bukan rekaman). Memakai kuota AI akun (admin tanpa batas).
import { bacaJson, denganPengguna, deps } from "@/lib/server";
import { rapikanSuara } from "@/lib/transaksi";

export async function POST(request: Request) {
  return denganPengguna(async (pengguna) => {
    const body = await bacaJson(request);
    const teks = typeof body.teks === "string" ? body.teks : "";
    return Response.json(await rapikanSuara(deps(pengguna).ai, teks));
  });
}

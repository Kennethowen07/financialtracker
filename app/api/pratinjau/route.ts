// POST /api/pratinjau  { teks: "rasela 25000 parkir 5000" }
// Kartu hasil input suara: apa yang akan tersimpan (deskripsi, nominal, kategori dari memori).
// Tidak menyimpan apa pun. Yang menyimpan tetap /api/catat setelah hitung mundur selesai.
import { bacaJson, denganPengguna, deps } from "@/lib/server";
import { pratinjauTeks } from "@/lib/transaksi";

export async function POST(request: Request) {
  return denganPengguna(async (pengguna) => {
    const body = await bacaJson(request);
    const teks = typeof body.teks === "string" ? body.teks.slice(0, 500) : "";
    return Response.json(await pratinjauTeks(deps(pengguna), teks));
  });
}

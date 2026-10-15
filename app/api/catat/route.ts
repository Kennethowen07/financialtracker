import { bacaJson, denganPengguna, deps } from "@/lib/server";
import { catatTeks } from "@/lib/transaksi";

// POST /api/catat  { teks: "kopi 15000 roti 25000" }
export async function POST(request: Request) {
  return denganPengguna(async (pengguna) => {
    const body = await bacaJson(request);
    const teks = typeof body.teks === "string" ? body.teks : "";
    if (teks.length > 500) return Response.json({ error: "Teks terlalu panjang (maks. 500 karakter)" }, { status: 400 });
    const hasil = await catatTeks(deps(pengguna), teks);
    return Response.json(hasil, { status: hasil.ok ? 200 : 422 });
  });
}

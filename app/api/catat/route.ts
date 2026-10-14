import { bacaJson, deps, tanganiError } from "@/lib/server";
import { catatTeks } from "@/lib/transaksi";

// POST /api/catat  { teks: "kopi 15000 roti 25000" }
export async function POST(request: Request) {
  const body = await bacaJson(request);
  const teks = typeof body.teks === "string" ? body.teks : "";
  if (teks.length > 500) return Response.json({ error: "Teks terlalu panjang (maks. 500 karakter)" }, { status: 400 });
  try {
    const hasil = await catatTeks(deps(), teks);
    return Response.json(hasil, { status: hasil.ok ? 200 : 422 });
  } catch (err) {
    return tanganiError(err);
  }
}

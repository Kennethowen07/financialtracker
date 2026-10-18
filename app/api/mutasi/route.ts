// POST /api/mutasi  { data: "<base64>", mimeType: "image/jpeg" }
// Baca SATU screenshot mutasi lewat Gemini (1 kuota AI akun per screenshot), lalu kembalikan
// baris untuk layar periksa. Gambar tidak disimpan. Beberapa screenshot = beberapa request,
// supaya tiap request tetap di bawah batas ukuran body Vercel (4,5 MB).
import { olahHasilMutasi } from "@/lib/mutasi";
import { bacaJson, denganPengguna, deps } from "@/lib/server";
import { hariIni } from "@/lib/tanggal";
import { periksaMutasi } from "@/lib/transaksi";

const JENIS_GAMBAR = ["image/jpeg", "image/png", "image/webp"];
const UKURAN_MAKS = 4_000_000; // karakter base64 (~3 MB gambar); browser sudah mengecilkan gambarnya

export async function POST(request: Request) {
  return denganPengguna(async (pengguna) => {
    const { data, mimeType } = await bacaJson(request);
    if (typeof data !== "string" || !data || typeof mimeType !== "string" || !JENIS_GAMBAR.includes(mimeType)) {
      return Response.json({ error: "Gambar tidak valid (JPG, PNG, atau WebP)" }, { status: 400 });
    }
    if (data.length > UKURAN_MAKS) return Response.json({ error: "Gambar terlalu besar" }, { status: 413 });

    const d = deps(pengguna);
    const tanggal = hariIni();
    const hasil = await d.ai.bacaMutasi({ data, mimeType }, tanggal);
    if (!hasil.ok) return Response.json({ ok: false, alasan: hasil.alasan === "kuota" ? "kuota" : "tidak_tersedia" });
    return Response.json({ ok: true, items: await periksaMutasi(d, olahHasilMutasi(hasil.data, tanggal)) });
  });
}

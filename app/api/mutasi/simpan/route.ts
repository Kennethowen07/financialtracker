// POST /api/mutasi/simpan  { items: [{ tanggal, nominal, keterangan, arah, sumber }] }
// Simpan baris mutasi yang dicentang di layar periksa. Kategori dari memori; yang belum dikenal
// dikembalikan dengan tanda tanya balik, sama seperti input ketik.
import { bacaJson, denganPengguna, deps } from "@/lib/server";
import { catatMutasi, type SimpanMutasi } from "@/lib/transaksi";

export async function POST(request: Request) {
  return denganPengguna(async (pengguna) => {
    const { items } = await bacaJson(request);
    return Response.json({ hasil: await catatMutasi(deps(pengguna), items as SimpanMutasi[]) });
  });
}

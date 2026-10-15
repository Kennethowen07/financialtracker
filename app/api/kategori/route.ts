import { daftarKategori } from "@/lib/kategori";
import { denganPengguna, deps } from "@/lib/server";

// GET /api/kategori → kategori bawaan + kategori buatan akun ini
export async function GET() {
  return denganPengguna(async (pengguna) => {
    const { db, penggunaId } = deps(pengguna);
    return Response.json(await daftarKategori(db, penggunaId));
  });
}

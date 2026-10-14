import { connection } from "next/server";
import { daftarKategori } from "@/lib/kategori";
import { deps, tanganiError } from "@/lib/server";

// GET /api/kategori
export async function GET() {
  await connection(); // selalu baca dari database, termasuk kategori buatan pengguna
  try {
    return Response.json(await daftarKategori(deps().db));
  } catch (err) {
    return tanganiError(err);
  }
}

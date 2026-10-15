import type { NextRequest } from "next/server";
import { bacaJson, denganPengguna, deps, idDariParam } from "@/lib/server";
import { jawabTanya, type PilihanKategori } from "@/lib/transaksi";

// POST /api/transaksi/12/jawab  { jenis: "pengeluaran", kategoriId: 1 }  atau  { jenis, kategoriBaru: "Hewan" }
export async function POST(request: NextRequest, ctx: RouteContext<"/api/transaksi/[id]/jawab">) {
  return denganPengguna(async (pengguna) => {
    const id = idDariParam((await ctx.params).id);
    if (id === null) return Response.json({ error: "ID tidak valid" }, { status: 400 });
    const body = await bacaJson(request);
    return Response.json(await jawabTanya(deps(pengguna), id, body as unknown as PilihanKategori));
  });
}

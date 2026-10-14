import type { NextRequest } from "next/server";
import { bacaJson, deps, idDariParam, tanganiError } from "@/lib/server";
import { jawabTanya, type PilihanKategori } from "@/lib/transaksi";

// POST /api/transaksi/12/jawab  { jenis: "pengeluaran", kategoriId: 1 }  atau  { jenis, kategoriBaru: "Hewan" }
export async function POST(request: NextRequest, ctx: RouteContext<"/api/transaksi/[id]/jawab">) {
  const id = idDariParam((await ctx.params).id);
  if (id === null) return Response.json({ error: "ID tidak valid" }, { status: 400 });
  const body = await bacaJson(request);
  try {
    return Response.json(await jawabTanya(deps(), id, body as unknown as PilihanKategori));
  } catch (err) {
    return tanganiError(err);
  }
}

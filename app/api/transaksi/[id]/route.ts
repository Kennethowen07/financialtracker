import type { NextRequest } from "next/server";
import { bacaJson, denganPengguna, deps, idDariParam } from "@/lib/server";
import { editTransaksi, hapusTransaksi, type UbahTransaksi } from "@/lib/transaksi";

// PATCH /api/transaksi/12  { kategoriId: 3 } / { tanggal: "2026-10-14" } / ...
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/transaksi/[id]">) {
  return denganPengguna(async (pengguna) => {
    const id = idDariParam((await ctx.params).id);
    if (id === null) return Response.json({ error: "ID tidak valid" }, { status: 400 });
    const body = await bacaJson(request);
    return Response.json(await editTransaksi(deps(pengguna), id, body as UbahTransaksi));
  });
}

// DELETE /api/transaksi/12
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/transaksi/[id]">) {
  return denganPengguna(async (pengguna) => {
    const id = idDariParam((await ctx.params).id);
    if (id === null) return Response.json({ error: "ID tidak valid" }, { status: 400 });
    const { db, penggunaId } = deps(pengguna);
    const terhapus = await hapusTransaksi(db, penggunaId, id);
    return terhapus ? new Response(null, { status: 204 }) : Response.json({ error: "Tidak ditemukan" }, { status: 404 });
  });
}

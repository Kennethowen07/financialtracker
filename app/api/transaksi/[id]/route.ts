import type { NextRequest } from "next/server";
import { bacaJson, deps, idDariParam, tanganiError } from "@/lib/server";
import { editTransaksi, hapusTransaksi, type UbahTransaksi } from "@/lib/transaksi";

// PATCH /api/transaksi/12  { kategoriId: 3 } / { tanggal: "2026-10-14" } / ...
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/transaksi/[id]">) {
  const id = idDariParam((await ctx.params).id);
  if (id === null) return Response.json({ error: "ID tidak valid" }, { status: 400 });
  const body = await bacaJson(request);
  try {
    return Response.json(await editTransaksi(deps(), id, body as UbahTransaksi));
  } catch (err) {
    return tanganiError(err);
  }
}

// DELETE /api/transaksi/12
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/transaksi/[id]">) {
  const id = idDariParam((await ctx.params).id);
  if (id === null) return Response.json({ error: "ID tidak valid" }, { status: 400 });
  try {
    const terhapus = await hapusTransaksi(deps().db, id);
    return terhapus ? new Response(null, { status: 204 }) : Response.json({ error: "Tidak ditemukan" }, { status: 404 });
  } catch (err) {
    return tanganiError(err);
  }
}

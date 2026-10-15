import type { NextRequest } from "next/server";
import { aturAktif } from "@/lib/akun";
import { db } from "@/lib/db";
import { bacaJson, denganPengguna, idDariParam } from "@/lib/server";

// PATCH /api/admin/pengguna/5  { aktif: false } → nonaktifkan / aktifkan akun (khusus admin)
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/pengguna/[id]">) {
  return denganPengguna(async (saya) => {
    if (!saya.admin) return Response.json({ error: "Khusus admin" }, { status: 403 });
    const id = idDariParam((await ctx.params).id);
    if (id === null) return Response.json({ error: "ID tidak valid" }, { status: 400 });
    if (id === saya.id) return Response.json({ error: "Tidak bisa menonaktifkan akun sendiri" }, { status: 400 });

    const { aktif } = await bacaJson(request);
    if (typeof aktif !== "boolean") return Response.json({ error: "aktif harus true/false" }, { status: 400 });
    return (await aturAktif(db, id, aktif))
      ? Response.json({ ok: true })
      : Response.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  });
}

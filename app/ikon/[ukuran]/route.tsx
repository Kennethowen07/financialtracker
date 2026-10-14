import type { NextRequest } from "next/server";
import { gambarIkon } from "@/lib/gambar-ikon";

const UKURAN = new Set([192, 512]);

// GET /ikon/192, /ikon/512, /ikon/512?maskable=1 → PNG untuk manifest PWA
export async function GET(request: NextRequest, ctx: RouteContext<"/ikon/[ukuran]">) {
  const ukuran = Number((await ctx.params).ukuran);
  if (!UKURAN.has(ukuran)) return new Response("Tidak ada", { status: 404 });
  return gambarIkon(ukuran, request.nextUrl.searchParams.has("maskable"));
}

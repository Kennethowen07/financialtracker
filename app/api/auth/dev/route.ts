// POST /api/auth/dev  { email }
// Login tanpa Google, KHUSUS development di laptop, supaya aplikasi bisa dicoba tanpa
// menyiapkan Google OAuth dulu (dan bisa mencoba beberapa akun sekaligus).
// Di production (Vercel) route ini selalu 404.
import { NextResponse } from "next/server";
import { masuk } from "@/lib/akun";
import { db } from "@/lib/db";
import { bacaJson, pasangSesi, tanganiError } from "@/lib/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });

  const { email } = await bacaJson(request);
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }
  try {
    const pengguna = await masuk(db, { email, nama: email.split("@")[0] });
    if (!pengguna) return NextResponse.json({ error: "Akun ini dinonaktifkan" }, { status: 403 });
    return pasangSesi(NextResponse.json({ ok: true }), pengguna.id);
  } catch (err) {
    return tanganiError(err);
  }
}

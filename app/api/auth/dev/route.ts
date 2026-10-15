// POST /api/auth/dev  { email }
// Login tanpa Google, KHUSUS development di laptop dengan database file (local.db), supaya
// aplikasi bisa dicoba tanpa menyiapkan Google OAuth dulu (dan bisa mencoba beberapa akun).
// Di production, atau kalau database-nya Turso, route ini selalu 404 (lihat loginDevAktif).
import { NextResponse } from "next/server";
import { masuk } from "@/lib/akun";
import { db } from "@/lib/db";
import { bacaJson, loginDevAktif, pasangSesi, tanganiError } from "@/lib/server";

export async function POST(request: Request) {
  if (!loginDevAktif()) return new Response(null, { status: 404 });

  const { email } = await bacaJson(request);
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }
  try {
    const hasil = await masuk(db, { email, nama: email.split("@")[0] });
    if (hasil === "nonaktif") return NextResponse.json({ error: "Akun ini dinonaktifkan" }, { status: 403 });
    if (hasil === "bentrok") return NextResponse.json({ error: "Email ini sudah dipakai akun lain" }, { status: 409 });
    return pasangSesi(NextResponse.json({ ok: true }), hasil.id);
  } catch (err) {
    return tanganiError(err);
  }
}

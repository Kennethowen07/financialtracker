import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { DaftarPengguna } from "@/components/DaftarPengguna";
import { Ikon } from "@/components/Ikon";
import { Kerangka } from "@/components/Kerangka";
import { daftarPengguna } from "@/lib/akun";
import { db } from "@/lib/db";
import { penggunaSaatIni } from "@/lib/server";

export const metadata = { title: "Pengguna · Financial Detector" };

// Khusus admin (email = ADMIN_EMAIL). Akun lain diarahkan kembali ke dashboard.
async function HalamanAdmin() {
  await connection();
  const pengguna = await penggunaSaatIni();
  if (!pengguna) redirect("/masuk");
  if (!pengguna.admin) redirect("/");

  return (
    <Kerangka aktif="admin" akun={{ nama: pengguna.nama, email: pengguna.email, admin: true }}>
      <header className="atas atas-judul">
        <Link href="/akun" className="tombol-bulat kembali" aria-label="Kembali ke akun">
          <Ikon nama="kiri" ukuran={20} />
        </Link>
        <h1 className="judul-halaman">Pengguna</h1>
      </header>
      <DaftarPengguna awal={await daftarPengguna(db)} sayaId={pengguna.id} />
    </Kerangka>
  );
}

export default function Halaman() {
  return (
    <Suspense fallback={<div className="memuat-halaman" aria-busy="true" />}>
      <HalamanAdmin />
    </Suspense>
  );
}

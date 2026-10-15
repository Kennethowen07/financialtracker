import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Ikon } from "@/components/Ikon";
import { Kerangka } from "@/components/Kerangka";
import { TombolKeluar } from "@/components/TombolKeluar";
import { penggunaSaatIni } from "@/lib/server";

export const metadata = { title: "Akun · Financial Detector" };

// Halaman akun: siapa yang sedang login, tautan admin, dan tombol keluar (penting di HP,
// karena sidebar hanya tampil di laptop).
async function HalamanAkun() {
  await connection();
  const pengguna = await penggunaSaatIni();
  if (!pengguna) redirect("/masuk");
  const akun = { nama: pengguna.nama, email: pengguna.email, admin: pengguna.admin };

  return (
    <Kerangka aktif="akun" akun={akun}>
      <header className="atas atas-judul">
        <Link href="/" className="tombol-bulat kembali" aria-label="Kembali ke dashboard">
          <Ikon nama="kiri" ukuran={20} />
        </Link>
        <h1 className="judul-halaman">Akun</h1>
      </header>
      <main className="kartu kartu-akun">
        <span className="akun-avatar" aria-hidden="true">{akun.nama.slice(0, 1).toUpperCase()}</span>
        <div className="akun-teks">
          <span className="akun-nama">
            {akun.nama}
            {akun.admin && <span className="lencana">Admin</span>}
          </span>
          <span className="akun-email">{akun.email}</span>
        </div>
        <p className="akun-catatan">Data transaksimu hanya bisa dilihat oleh akun ini.</p>
        {akun.admin && (
          <Link href="/admin" className="tombol-kedua">
            <Ikon nama="pengguna" />
            Kelola pengguna
          </Link>
        )}
        <TombolKeluar className="tombol-kedua tombol-keluar" />
      </main>
    </Kerangka>
  );
}

export default function Halaman() {
  return (
    <Suspense fallback={<div className="memuat-halaman" aria-busy="true" />}>
      <HalamanAkun />
    </Suspense>
  );
}

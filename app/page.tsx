import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Dasbor } from "@/components/Dasbor";
import { db } from "@/lib/db";
import { daftarKategori } from "@/lib/kategori";
import { penggunaSaatIni } from "@/lib/server";
import { bulanSebelumnya, hariIni } from "@/lib/tanggal";
import { daftarTransaksi } from "@/lib/transaksi";

// Server Component: mengambil data awal akun yang login langsung dari database, lalu
// menyerahkannya ke <Dasbor> (Client Component) supaya layar langsung terisi tanpa loading kedua.
async function HalamanDasbor() {
  await connection(); // data dibaca saat ada request, bukan saat build
  const pengguna = await penggunaSaatIni();
  if (!pengguna) redirect("/masuk");

  const tanggal = hariIni();
  const bulan = tanggal.slice(0, 7);
  const [kategori, transaksi, transaksiLalu] = await Promise.all([
    daftarKategori(db, pengguna.id),
    daftarTransaksi(db, pengguna.id, bulan),
    daftarTransaksi(db, pengguna.id, bulanSebelumnya(bulan)),
  ]);
  return (
    <Dasbor
      hariIni={tanggal}
      awal={{ kategori, transaksi, transaksiLalu }}
      akun={{ nama: pengguna.nama, email: pengguna.email, admin: pengguna.admin }}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="memuat-halaman" aria-busy="true" />}>
      <HalamanDasbor />
    </Suspense>
  );
}

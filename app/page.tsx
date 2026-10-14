import { Suspense } from "react";
import { connection } from "next/server";
import { Dasbor } from "@/components/Dasbor";
import { db } from "@/lib/db";
import { daftarKategori } from "@/lib/kategori";
import { bulanSebelumnya, hariIni } from "@/lib/tanggal";
import { daftarTransaksi } from "@/lib/transaksi";

// Server Component: mengambil data awal langsung dari database, lalu menyerahkannya
// ke <Dasbor> (Client Component) supaya layar langsung terisi tanpa loading kedua.
async function HalamanDasbor() {
  await connection(); // data dibaca saat ada request, bukan saat build
  const tanggal = hariIni();
  const bulan = tanggal.slice(0, 7);
  const [kategori, transaksi, transaksiLalu] = await Promise.all([
    daftarKategori(db),
    daftarTransaksi(db, bulan),
    daftarTransaksi(db, bulanSebelumnya(bulan)),
  ]);
  return (
    <Dasbor
      hariIni={tanggal}
      aiAktif={Boolean(process.env.GEMINI_API_KEY)}
      awal={{ kategori, transaksi, transaksiLalu }}
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

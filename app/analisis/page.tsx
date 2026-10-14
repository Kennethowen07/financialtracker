import { Suspense } from "react";
import { connection } from "next/server";
import { AnalisisAI } from "@/components/AnalisisAI";
import { ambilAnalisis } from "@/lib/analisis";
import { db } from "@/lib/db";
import { ringkas } from "@/lib/laporan";
import { bulanSebelumnya, hariIni } from "@/lib/tanggal";
import { daftarTransaksi } from "@/lib/transaksi";

export const metadata = { title: "Analisis AI · Financial Detector" };

async function HalamanAnalisis({ searchParams }: PageProps<"/analisis">) {
  await connection();
  const tanggal = hariIni();
  const bulanIni = tanggal.slice(0, 7);
  const diminta = (await searchParams).bulan;
  const bulan = typeof diminta === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(diminta) && diminta <= bulanIni ? diminta : bulanIni;

  const [analisis, ini, lalu] = await Promise.all([
    ambilAnalisis(db, bulan),
    daftarTransaksi(db, bulan),
    daftarTransaksi(db, bulanSebelumnya(bulan)),
  ]);
  const r = ringkas(bulan, ini, lalu, tanggal);

  return (
    <AnalisisAI
      key={bulan}
      bulan={bulan}
      bulanIni={bulanIni}
      analisis={analisis}
      palingSering={r.palingSering}
      aiAktif={Boolean(process.env.GEMINI_API_KEY)}
    />
  );
}

export default function Halaman(props: PageProps<"/analisis">) {
  return (
    <Suspense fallback={<div className="memuat-halaman" aria-busy="true" />}>
      <HalamanAnalisis {...props} />
    </Suspense>
  );
}

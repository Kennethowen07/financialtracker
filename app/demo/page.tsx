import { Suspense } from "react";
import { connection } from "next/server";
import { DasborDemo } from "@/components/DasborDemo";
import { hariIni } from "@/lib/tanggal";

export const metadata = { title: "Demo · Financial Detector" };

async function HalamanDemo() {
  await connection(); // tanggal "hari ini" dihitung saat dibuka, bukan saat build
  return <DasborDemo hariIni={hariIni()} aiAktif={Boolean(process.env.GEMINI_API_KEY)} />;
}

export default function Halaman() {
  return (
    <Suspense fallback={<div className="memuat-halaman" aria-busy="true" />}>
      <HalamanDemo />
    </Suspense>
  );
}

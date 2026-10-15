import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { FormMasuk } from "@/components/FormMasuk";
import { googleAktif } from "@/lib/google";
import { penggunaSaatIni } from "@/lib/server";

export const metadata = { title: "Masuk · Financial Detector" };

const PESAN_GALAT: Record<string, string> = {
  belum_diatur: "Login Google belum diatur di server.",
  dibatalkan: "Login dibatalkan.",
  gagal: "Login gagal. Coba lagi.",
  nonaktif: "Akun ini dinonaktifkan admin.",
};

async function HalamanMasuk({ searchParams }: PageProps<"/masuk">) {
  await connection();
  if (await penggunaSaatIni()) redirect("/");
  const kode = (await searchParams).galat;
  return (
    <FormMasuk
      google={googleAktif()}
      dev={process.env.NODE_ENV !== "production"}
      galat={typeof kode === "string" ? (PESAN_GALAT[kode] ?? null) : null}
    />
  );
}

export default function Halaman(props: PageProps<"/masuk">) {
  return (
    <Suspense fallback={<div className="memuat-halaman" aria-busy="true" />}>
      <HalamanMasuk {...props} />
    </Suspense>
  );
}

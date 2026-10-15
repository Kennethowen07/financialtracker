import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { FormMasuk } from "@/components/FormMasuk";
import { googleAktif } from "@/lib/google";
import { loginDevAktif, penggunaSaatIni } from "@/lib/server";

export const metadata = { title: "Masuk · Financial Detector" };

const PESAN_GALAT: Record<string, string> = {
  belum_diatur: "Login Google belum diatur di server.",
  dibatalkan: "Login dibatalkan.",
  gagal: "Login gagal. Coba lagi.",
  nonaktif: "Akun ini dinonaktifkan admin.",
  bentrok: "Email ini sudah terdaftar dengan akun Google lain.",
};

async function HalamanMasuk({ searchParams }: PageProps<"/masuk">) {
  await connection();
  if (await penggunaSaatIni()) redirect("/");
  const kode = (await searchParams).galat;
  const galat = typeof kode === "string" ? (PESAN_GALAT[kode] ?? null) : null;
  // key: pesan galat baru (dari alamat) menggantikan pesan lama yang tersimpan di form.
  return <FormMasuk key={galat ?? ""} google={googleAktif()} dev={loginDevAktif()} galat={galat} />;
}

export default function Halaman(props: PageProps<"/masuk">) {
  return (
    <Suspense fallback={<div className="memuat-halaman" aria-busy="true" />}>
      <HalamanMasuk {...props} />
    </Suspense>
  );
}

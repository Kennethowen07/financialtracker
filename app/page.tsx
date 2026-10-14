import { Suspense } from "react";
import { connection } from "next/server";
import { db, lokasiDatabase } from "@/lib/db";

// Halaman sementara Tahap 1: memastikan Next.js dan database tersambung.
// Diganti layar utama di Tahap 4.

async function StatusDatabase() {
  // Data harus dibaca saat ada request, bukan saat build.
  await connection();
  const jumlah = await hitungKategori();
  if (jumlah === null) {
    return <p>Database belum siap. Jalankan <code>npm run db:setup</code> dulu.</p>;
  }
  return (
    <p>
      Database tersambung ({lokasiDatabase}). <span className="num">{jumlah}</span> kategori terisi.
    </p>
  );
}

async function hitungKategori(): Promise<number | null> {
  try {
    const { rows } = await db.execute("SELECT COUNT(*) AS jumlah FROM kategori");
    return Number(rows[0].jumlah);
  } catch {
    return null; // tabel belum dibuat
  }
}

export default function Home() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 22 }}>Financial Detector</h1>
      <Suspense fallback={<p>Mengecek database…</p>}>
        <StatusDatabase />
      </Suspense>
    </main>
  );
}

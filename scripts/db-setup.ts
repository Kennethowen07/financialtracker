// Membuat tabel dan mengisi kategori bawaan.
// Jalankan: npm run db:setup
import { muatEnv } from "./env";

async function main() {
  muatEnv();
  // Diimpor setelah env dimuat, karena koneksi dibuat saat modul diimpor.
  const { db, lokasiDatabase } = await import("../lib/db");
  const { siapkanDatabase } = await import("../lib/skema");

  await siapkanDatabase(db);

  const { rows } = await db.execute(
    "SELECT jenis, COUNT(*) AS jumlah FROM kategori GROUP BY jenis ORDER BY jenis",
  );
  console.log(`Database siap (${lokasiDatabase}).`);
  for (const row of rows) console.log(`  ${row.jenis}: ${row.jumlah} kategori`);
}

main().catch((err) => {
  console.error("Gagal menyiapkan database:", err);
  process.exit(1);
});

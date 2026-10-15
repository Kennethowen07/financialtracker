// Backup database (Turso atau local.db) ke file SQL, pengganti `turso db shell ... .dump`
// yang butuh Turso CLI. Hanya MEMBACA database, tidak mengubah apa pun.
// Jalankan: npm run db:backup   → backup/backup-YYYY-MM-DD-HHMM.sql
// Memulihkan: jalankan isi file itu di database kosong (mis. `turso db shell <db> < file.sql`).
import { mkdirSync, writeFileSync } from "node:fs";
import { muatEnv } from "./env";

/** Nilai SQL → teks literal untuk perintah INSERT. */
function literal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v instanceof ArrayBuffer) return `X'${Buffer.from(v).toString("hex")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  muatEnv();
  // Diimpor setelah env dimuat, karena koneksi dibuat saat modul diimpor.
  const { db, lokasiDatabase } = await import("../lib/db");

  const { rows: objek } = await db.execute(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' AND name NOT LIKE '_litestream%'
     ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
  );

  const baris: string[] = [
    `-- Backup Financial Detector (${lokasiDatabase}), ${new Date().toISOString()}`,
    "PRAGMA foreign_keys = OFF;",
    "BEGIN TRANSACTION;",
  ];
  let total = 0;
  for (const o of objek.filter((o) => o.type === "table")) {
    const nama = String(o.name);
    baris.push("", `${o.sql};`);
    const { rows, columns } = await db.execute(`SELECT * FROM "${nama}"`);
    const kolom = columns.map((c) => `"${c}"`).join(", ");
    for (const r of rows) {
      baris.push(`INSERT INTO "${nama}" (${kolom}) VALUES (${columns.map((c) => literal(r[c])).join(", ")});`);
    }
    console.log(`  ${nama}: ${rows.length} baris`);
    total += rows.length;
  }
  baris.push("");
  for (const o of objek.filter((o) => o.type !== "table")) baris.push(`${o.sql};`);
  baris.push("COMMIT;", "");

  mkdirSync("backup", { recursive: true });
  const waktu = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const file = `backup/backup-${waktu}.sql`;
  writeFileSync(file, baris.join("\n"));
  console.log(`Backup selesai (${lokasiDatabase}): ${total} baris → ${file}`);
}

main().catch((err) => {
  console.error("Backup gagal:", err);
  process.exit(1);
});

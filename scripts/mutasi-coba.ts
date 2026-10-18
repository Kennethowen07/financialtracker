// Uji baca screenshot mutasi lewat Gemini, sebelum fiturnya dibangun di aplikasi.
// Jalankan: npm run mutasi:coba   (membaca semua gambar di data/mutasi/, folder ini tidak ikut git)
//           npm run mutasi:coba -- data/mutasi/bca.jpeg   (satu file saja)
// Hanya membaca gambar dan menampilkan hasil; tidak menyimpan apa pun ke database.
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { muatEnv } from "./env";

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function main() {
  muatEnv();
  const { buatLayananGemini } = await import("../lib/ai");
  const { olahHasilMutasi } = await import("../lib/mutasi");
  const { hariIni } = await import("../lib/tanggal");

  const ai = buatLayananGemini();
  if (!ai.aktif) {
    console.error("GEMINI_API_KEY kosong di .env.local.");
    process.exit(1);
  }

  const argumen = process.argv.slice(2);
  const folder = "data/mutasi";
  const berkas = argumen.length
    ? argumen
    : readdirSync(folder).filter((f) => MIME[extname(f).toLowerCase()]).map((f) => join(folder, f));
  const tanggal = hariIni();
  console.log(`Model: ${process.env.GEMINI_MODEL || "gemini-flash-latest"}, hari ini ${tanggal}\n`);

  for (const f of berkas) {
    const mulai = Date.now();
    const hasil = await ai.bacaMutasi({ data: readFileSync(f).toString("base64"), mimeType: MIME[extname(f).toLowerCase()] }, tanggal);
    const detik = ((Date.now() - mulai) / 1000).toFixed(1);
    if (!hasil.ok) {
      console.log(`== ${f}: GAGAL (${hasil.alasan}) setelah ${detik} dtk\n`);
      continue;
    }
    const baris = olahHasilMutasi(hasil.data, tanggal);
    const mentah = (JSON.parse(hasil.data).transaksi ?? []).length;
    console.log(`== ${f}: ${baris.length} transaksi (${mentah} dari Gemini), ${detik} dtk`);
    console.table(baris.map((b) => ({
      tanggal: b.tanggal,
      keterangan: b.keterangan,
      nominal: b.nominal,
      arah: b.arah,
      golongan: b.golongan,
      sumber: b.sumber,
      tanda: [b.terpotong && "terpotong", b.pending && "pending"].filter(Boolean).join(","),
    })));
  }
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exit(1);
});

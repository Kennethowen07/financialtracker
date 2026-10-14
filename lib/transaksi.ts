// Alur mencatat transaksi (docs/PRD.md "Alur pengguna"):
//   teks → parser (nominal, tanggal, pecah per nominal)
//        → memori (persis / tahan typo)            → tersimpan, sumber "memori"
//        → kalau tidak ketemu: Gemini
//             yakin                                 → tersimpan, sumber "ai" (+ masuk memori)
//             ragu / gagal / lambat / kuota habis   → tersimpan TANPA kategori, perlu tanya balik
import type { Client } from "@libsql/client";
import type { LayananAI, TebakanKategori } from "./ai";
import { daftarKategori, KesalahanInput, tentukanKategori } from "./kategori";
import { cariMemori, contohMirip, simpanMemori, tandaiDipakai } from "./memori";
import { bacaInput, SEMUA_JENIS, type AlasanGagalBaca, type Jenis } from "./parser";
import { hariIni } from "./tanggal";

export type Sumber = "memori" | "ai" | "tanya_balik" | "manual" | "import";
export type Arah = "keluar" | "masuk";

export interface Transaksi {
  id: number;
  tanggal: string;
  nominal: number;
  jenis: Jenis;
  arah: Arah;
  kategori: { id: number; nama: string; ikon: string } | null;
  deskripsi: string;
  sumber: Sumber;
  dikoreksi: boolean;
  /** Kategori belum ditentukan → tampilkan tanya balik. */
  perluTanya: boolean;
  dibuatPada: string;
}

export interface Deps {
  db: Client;
  ai: LayananAI;
  sekarang?: () => Date;
}

export interface HasilItem {
  transaksi: Transaksi;
  /** null = sudah beres. Selain itu tampilkan panel tanya balik; tanyaJenis = tampilkan pilihan jenis juga. */
  tanya: null | { tanyaJenis: boolean };
}

export type HasilCatat =
  | { ok: true; tanggalDariTeks: boolean; aiTersedia: boolean; hasil: HasilItem[] }
  | { ok: false; alasan: AlasanGagalBaca };

// ---------- bantuan ----------

const KATA_TARIK = /\b(tarik|penarikan|jual|withdraw|wd|cair|pencairan|dividen)\b/i;

/** Arah uang dari jenis. Untuk investasi dibaca dari kata (tarik/jual = masuk). */
export function arahUntuk(jenis: Jenis, deskripsi: string, saranAI?: Arah): Arah {
  if (jenis === "pemasukan") return "masuk";
  if (jenis !== "investasi") return "keluar";
  if (KATA_TARIK.test(deskripsi)) return "masuk";
  return saranAI ?? "keluar";
}

function cekJenis(jenis: unknown): Jenis {
  if (typeof jenis !== "string" || !SEMUA_JENIS.includes(jenis as Jenis)) throw new KesalahanInput("Jenis tidak valid");
  return jenis as Jenis;
}

function cekNominal(n: unknown): number {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0 || n > 1_000_000_000_000) {
    throw new KesalahanInput("Nominal harus bilangan bulat lebih dari 0");
  }
  return n;
}

function cekDeskripsi(d: unknown): string {
  const s = typeof d === "string" ? d.trim().replace(/\s+/g, " ") : "";
  if (!s || s.length > 100) throw new KesalahanInput("Deskripsi wajib diisi (maks. 100 karakter)");
  return s;
}

function cekTanggal(t: unknown, sekarang: Date): string {
  if (typeof t !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new KesalahanInput("Tanggal tidak valid");
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) throw new KesalahanInput("Tanggal tidak valid");
  if (t > hariIni(sekarang)) throw new KesalahanInput("Tanggal masa depan tidak boleh");
  return t;
}

const SELECT_TRANSAKSI = `
  SELECT t.id, t.tanggal, t.nominal, t.jenis, t.arah, t.deskripsi, t.sumber, t.dikoreksi, t.dibuat_pada,
         k.id AS k_id, k.nama AS k_nama, k.ikon AS k_ikon
  FROM transaksi t LEFT JOIN kategori k ON k.id = t.kategori_id`;

function keTransaksi(r: Record<string, unknown>): Transaksi {
  const jenis = r.jenis as Jenis;
  return {
    id: Number(r.id),
    tanggal: String(r.tanggal),
    nominal: Number(r.nominal),
    jenis,
    arah: r.arah as Arah,
    kategori: r.k_id == null ? null : { id: Number(r.k_id), nama: String(r.k_nama), ikon: String(r.k_ikon) },
    deskripsi: String(r.deskripsi),
    sumber: r.sumber as Sumber,
    dikoreksi: Number(r.dikoreksi) === 1,
    perluTanya: r.k_id == null && jenis !== "usaha",
    dibuatPada: String(r.dibuat_pada),
  };
}

export async function ambilTransaksi(db: Client, id: number): Promise<Transaksi | null> {
  const { rows } = await db.execute({ sql: `${SELECT_TRANSAKSI} WHERE t.id = ?`, args: [id] });
  return rows[0] ? keTransaksi(rows[0] as Record<string, unknown>) : null;
}

/** Semua transaksi satu bulan (YYYY-MM), terbaru dulu. */
export async function daftarTransaksi(db: Client, bulan: string): Promise<Transaksi[]> {
  const { rows } = await db.execute({
    sql: `${SELECT_TRANSAKSI} WHERE t.tanggal BETWEEN ? AND ? ORDER BY t.tanggal DESC, t.id DESC`,
    args: [`${bulan}-01`, `${bulan}-31`],
  });
  return rows.map((r) => keTransaksi(r as Record<string, unknown>));
}

async function sisipkan(
  db: Client,
  data: { tanggal: string; nominal: number; jenis: Jenis; arah: Arah; kategoriId: number | null; deskripsi: string; teksAsli: string; sumber: Sumber },
  waktu: Date,
): Promise<Transaksi> {
  const res = await db.execute({
    sql: `INSERT INTO transaksi (tanggal, nominal, jenis, arah, kategori_id, deskripsi, teks_asli, sumber, dibuat_pada)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [data.tanggal, data.nominal, data.jenis, data.arah, data.jenis === "usaha" ? null : data.kategoriId,
      data.deskripsi, data.teksAsli, data.sumber, waktu.toISOString()],
  });
  return (await ambilTransaksi(db, Number(res.lastInsertRowid)))!;
}

// ---------- mencatat dari teks ----------

/** Validasi tebakan AI terhadap daftar kategori. Kategori di luar daftar = ragu (PRD). */
function nilaiTebakan(
  tebakan: TebakanKategori,
  kategori: { id: number; nama: string; jenis: string }[],
  jenisPasti: Jenis | null,
): { jenis: Jenis; kategoriId: number | null; arah: Arah; yakin: boolean; tanyaJenis: boolean } {
  const jenisValid = SEMUA_JENIS.includes(tebakan.jenis);
  const jenis = jenisPasti ?? (jenisValid ? tebakan.jenis : "pengeluaran");
  const yakinJenis = jenisPasti ? true : tebakan.yakinJenis && jenisValid;

  if (jenis === "usaha") {
    return { jenis, kategoriId: null, arah: "keluar", yakin: yakinJenis, tanyaJenis: !yakinJenis };
  }
  const nama = (tebakan.kategori ?? "").toLowerCase();
  const cocok = kategori.find((k) => k.jenis === jenis && k.nama.toLowerCase() === nama);
  const yakin = yakinJenis && tebakan.yakinKategori && Boolean(cocok);
  return { jenis, kategoriId: cocok?.id ?? null, arah: tebakan.arah, yakin, tanyaJenis: !yakinJenis };
}

export async function catatTeks(deps: Deps, teks: string): Promise<HasilCatat> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const baca = bacaInput(teks, sekarang);
  if (!baca.ok) return baca;

  const { db, ai } = deps;
  const kategori = await daftarKategori(db);
  let aiTersedia = ai.aktif;

  // Langkah 1: cek memori untuk tiap item.
  const cekMemori = await Promise.all(baca.items.map((item) => cariMemori(db, item.deskripsi)));

  // Langkah 2: item yang tidak ketemu (atau jenisnya bertentangan dengan tanda +) ditanya ke AI, paralel.
  const tebakan = await Promise.all(
    baca.items.map(async (item, i) => {
      const m = cekMemori[i];
      if (m && (!item.jenisPasti || item.jenisPasti === m.jenis)) return null;
      if (!ai.aktif) return { ok: false as const, alasan: "tidak_aktif" as const };
      return ai.tebakKategori({
        deskripsi: item.deskripsi,
        kategori: kategori.map((k) => ({ nama: k.nama, jenis: k.jenis })),
        contoh: await contohMirip(db, item.deskripsi),
      });
    }),
  );

  // Langkah 3: simpan semuanya (berurutan supaya id urut sesuai kalimat).
  const hasil: HasilItem[] = [];
  for (const [i, item] of baca.items.entries()) {
    const m = cekMemori[i];
    const t = tebakan[i];
    const dasar = { tanggal: baca.tanggal, nominal: item.nominal, deskripsi: item.deskripsi, teksAsli: teks.trim() };

    if (!t && m) {
      await tandaiDipakai(db, m.id, sekarang);
      const trx = await sisipkan(db, {
        ...dasar, jenis: m.jenis, arah: arahUntuk(m.jenis, item.deskripsi), kategoriId: m.kategoriId, sumber: "memori",
      }, sekarang);
      hasil.push({ transaksi: trx, tanya: null });
      continue;
    }

    if (t?.ok) {
      const n = nilaiTebakan(t.data, kategori, item.jenisPasti);
      const arah = arahUntuk(n.jenis, item.deskripsi, n.arah);
      if (n.yakin) {
        const trx = await sisipkan(db, { ...dasar, jenis: n.jenis, arah, kategoriId: n.kategoriId, sumber: "ai" }, sekarang);
        // Disimpan ke memori supaya input yang sama berikutnya tidak memanggil AI lagi.
        await simpanMemori(db, { deskripsi: item.deskripsi, jenis: n.jenis, kategoriId: n.kategoriId, asal: "ai" }, sekarang);
        hasil.push({ transaksi: trx, tanya: null });
      } else {
        // Ragu: simpan dengan jenis tebakan (atau default) tapi tanpa kategori.
        const jenis = n.tanyaJenis ? (item.jenisPasti ?? "pengeluaran") : n.jenis;
        const trx = await sisipkan(db, {
          ...dasar, jenis, arah: arahUntuk(jenis, item.deskripsi, arah), kategoriId: null, sumber: "tanya_balik",
        }, sekarang);
        hasil.push({ transaksi: trx, tanya: { tanyaJenis: n.tanyaJenis } });
      }
      continue;
    }

    // AI tidak tersedia (nonaktif, error, lambat, kuota habis): langsung tanya balik.
    if (t && !t.ok && t.alasan !== "tidak_aktif") aiTersedia = false;
    const jenis = item.jenisPasti ?? "pengeluaran";
    const trx = await sisipkan(db, {
      ...dasar, jenis, arah: arahUntuk(jenis, item.deskripsi), kategoriId: null, sumber: "tanya_balik",
    }, sekarang);
    hasil.push({ transaksi: trx, tanya: { tanyaJenis: !item.jenisPasti } });
  }

  return { ok: true, tanggalDariTeks: baca.tanggalDariTeks, aiTersedia, hasil };
}

// ---------- tanya balik, edit, manual, hapus ----------

export interface PilihanKategori {
  jenis: Jenis;
  kategoriId?: number | null;
  kategoriBaru?: string | null;
}

/** Jawaban panel tanya balik: tetapkan jenis + kategori, lalu ingat di memori. */
export async function jawabTanya(deps: Deps, id: number, pilihan: PilihanKategori): Promise<Transaksi> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const lama = await ambilTransaksi(deps.db, id);
  if (!lama) throw new KesalahanInput("Transaksi tidak ditemukan");
  const jenis = cekJenis(pilihan.jenis);
  const kategoriId = await tentukanKategori(deps.db, jenis, pilihan);

  await deps.db.execute({
    sql: "UPDATE transaksi SET jenis = ?, arah = ?, kategori_id = ?, sumber = 'tanya_balik' WHERE id = ?",
    args: [jenis, arahUntuk(jenis, lama.deskripsi), kategoriId, id],
  });
  await simpanMemori(deps.db, { deskripsi: lama.deskripsi, jenis, kategoriId, asal: "tanya_balik" }, sekarang);
  return (await ambilTransaksi(deps.db, id))!;
}

export interface UbahTransaksi {
  tanggal?: string;
  nominal?: number;
  deskripsi?: string;
  jenis?: Jenis;
  arah?: Arah;
  kategoriId?: number | null;
  kategoriBaru?: string | null;
}

/** Edit transaksi. Kalau jenis/kategori berubah, memori ikut diperbarui (PRD fitur 6). */
export async function editTransaksi(deps: Deps, id: number, ubah: UbahTransaksi): Promise<Transaksi> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const lama = await ambilTransaksi(deps.db, id);
  if (!lama) throw new KesalahanInput("Transaksi tidak ditemukan");

  const tanggal = ubah.tanggal !== undefined ? cekTanggal(ubah.tanggal, sekarang) : lama.tanggal;
  const nominal = ubah.nominal !== undefined ? cekNominal(ubah.nominal) : lama.nominal;
  const deskripsi = ubah.deskripsi !== undefined ? cekDeskripsi(ubah.deskripsi) : lama.deskripsi;
  const jenis = ubah.jenis !== undefined ? cekJenis(ubah.jenis) : lama.jenis;

  const gantiKategori = ubah.jenis !== undefined || ubah.kategoriId !== undefined || Boolean(ubah.kategoriBaru);
  const kategoriId = gantiKategori
    ? await tentukanKategori(deps.db, jenis, {
        kategoriId: ubah.kategoriId !== undefined ? ubah.kategoriId : lama.kategori?.id ?? null,
        kategoriBaru: ubah.kategoriBaru,
      })
    : lama.kategori?.id ?? null;

  let arah: Arah;
  if (jenis !== "investasi") arah = arahUntuk(jenis, deskripsi);
  else arah = ubah.arah ?? (lama.jenis === "investasi" ? lama.arah : arahUntuk(jenis, deskripsi));

  const berubah = jenis !== lama.jenis || kategoriId !== (lama.kategori?.id ?? null);
  // Mengisi kategori yang tadinya kosong = menjawab tanya balik, bukan koreksi.
  const koreksi = berubah && !lama.perluTanya;
  const sumber: Sumber = lama.perluTanya && berubah ? "tanya_balik" : lama.sumber;

  await deps.db.execute({
    sql: `UPDATE transaksi SET tanggal = ?, nominal = ?, deskripsi = ?, jenis = ?, arah = ?, kategori_id = ?,
            sumber = ?, dikoreksi = CASE WHEN ? = 1 THEN 1 ELSE dikoreksi END
          WHERE id = ?`,
    args: [tanggal, nominal, deskripsi, jenis, arah, kategoriId, sumber, koreksi ? 1 : 0, id],
  });
  const lengkap = jenis === "usaha" || kategoriId !== null;
  if (lengkap && (berubah || deskripsi !== lama.deskripsi)) {
    await simpanMemori(deps.db, { deskripsi, jenis, kategoriId, asal: koreksi ? "koreksi" : "tanya_balik" }, sekarang);
  }
  return (await ambilTransaksi(deps.db, id))!;
}

export interface TransaksiManual extends PilihanKategori {
  tanggal: string;
  nominal: number;
  deskripsi: string;
  arah?: Arah;
}

/** Form manual (PRD fitur 7): semua isian dari pengguna, ikut diingat di memori. */
export async function tambahManual(deps: Deps, data: TransaksiManual): Promise<Transaksi> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const tanggal = cekTanggal(data.tanggal, sekarang);
  const nominal = cekNominal(data.nominal);
  const deskripsi = cekDeskripsi(data.deskripsi);
  const jenis = cekJenis(data.jenis);
  const kategoriId = await tentukanKategori(deps.db, jenis, data);
  const arah = jenis === "investasi" ? (data.arah ?? arahUntuk(jenis, deskripsi)) : arahUntuk(jenis, deskripsi);

  const trx = await sisipkan(deps.db, {
    tanggal, nominal, jenis, arah, kategoriId, deskripsi, teksAsli: deskripsi, sumber: "manual",
  }, sekarang);
  await simpanMemori(deps.db, { deskripsi, jenis, kategoriId, asal: "manual" }, sekarang);
  return trx;
}

export async function hapusTransaksi(db: Client, id: number): Promise<boolean> {
  const res = await db.execute({ sql: "DELETE FROM transaksi WHERE id = ?", args: [id] });
  return res.rowsAffected > 0;
}

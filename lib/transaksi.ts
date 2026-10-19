// Alur mencatat transaksi:
//   teks → parser (nominal dalam angka/kata, tanggal, pecah per nominal)
//        → memori (persis / tahan typo)  → tersimpan, sumber "memori"
//        → tidak ketemu                  → tersimpan TANPA kategori, perlu tanya balik
// AI tidak lagi dipakai untuk kategori (versi 3). Sumber "ai" hanya ada di data lama.
import type { Client } from "@libsql/client";
import type { LayananAI } from "./ai";
import { daftarKategori, KesalahanInput, tentukanKategori } from "./kategori";
import { cariMemori, simpanMemori, tandaiDipakai, type EntriMemori } from "./memori";
import type { BarisMutasi, ItemPeriksa } from "./mutasi";
import { bacaInput, SEMUA_JENIS, type AlasanGagalBaca, type ItemTerbaca, type Jenis } from "./parser";
import { hariIni } from "./tanggal";

export type Sumber = "memori" | "ai" | "tanya_balik" | "manual" | "import";
export type Arah = "keluar" | "masuk";
export type CaraInput = "ketik" | "suara" | "form" | "import";

export interface Transaksi {
  id: number;
  tanggal: string;
  nominal: number;
  jenis: Jenis;
  arah: Arah;
  kategori: { id: number; nama: string; ikon: string } | null;
  deskripsi: string;
  sumber: Sumber;
  caraInput: CaraInput;
  dikoreksi: boolean;
  /** Kategori belum ditentukan → tampilkan tanya balik. */
  perluTanya: boolean;
  dibuatPada: string;
}

export interface Deps {
  db: Client;
  /** Hanya untuk Analisis AI dan cadangan input suara. */
  ai: LayananAI;
  /** Akun yang sedang memakai aplikasi. Semua data dibaca/ditulis atas nama akun ini saja. */
  penggunaId: number;
  sekarang?: () => Date;
}

export interface HasilItem {
  transaksi: Transaksi;
  /** null = sudah beres. Selain itu tampilkan panel tanya balik; tanyaJenis = tampilkan pilihan jenis juga. */
  tanya: null | { tanyaJenis: boolean };
}

export type HasilCatat =
  | { ok: true; tanggalDariTeks: boolean; hasil: HasilItem[] }
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
  SELECT t.id, t.tanggal, t.nominal, t.jenis, t.arah, t.deskripsi, t.sumber, t.cara_input, t.dikoreksi, t.dibuat_pada,
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
    caraInput: (r.cara_input ?? "ketik") as CaraInput,
    dikoreksi: Number(r.dikoreksi) === 1,
    perluTanya: r.k_id == null && jenis !== "usaha",
    dibuatPada: String(r.dibuat_pada),
  };
}

/** Satu transaksi milik akun ini. Transaksi akun lain dianggap tidak ada. */
export async function ambilTransaksi(db: Client, penggunaId: number, id: number): Promise<Transaksi | null> {
  const { rows } = await db.execute({
    sql: `${SELECT_TRANSAKSI} WHERE t.id = ? AND t.pengguna_id = ?`,
    args: [id, penggunaId],
  });
  return rows[0] ? keTransaksi(rows[0] as Record<string, unknown>) : null;
}

/** Semua transaksi akun ini dalam satu bulan (YYYY-MM), terbaru dulu. */
export async function daftarTransaksi(db: Client, penggunaId: number, bulan: string): Promise<Transaksi[]> {
  const { rows } = await db.execute({
    sql: `${SELECT_TRANSAKSI} WHERE t.pengguna_id = ? AND t.tanggal BETWEEN ? AND ? ORDER BY t.tanggal DESC, t.id DESC`,
    args: [penggunaId, `${bulan}-01`, `${bulan}-31`],
  });
  return rows.map((r) => keTransaksi(r as Record<string, unknown>));
}

async function sisipkan(
  db: Client,
  penggunaId: number,
  data: {
    tanggal: string; nominal: number; jenis: Jenis; arah: Arah; kategoriId: number | null;
    deskripsi: string; teksAsli: string; sumber: Sumber; caraInput: CaraInput;
  },
  waktu: Date,
): Promise<Transaksi> {
  const res = await db.execute({
    sql: `INSERT INTO transaksi (pengguna_id, tanggal, nominal, jenis, arah, kategori_id, deskripsi, teks_asli, sumber, cara_input, dibuat_pada)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [penggunaId, data.tanggal, data.nominal, data.jenis, data.arah, data.jenis === "usaha" ? null : data.kategoriId,
      data.deskripsi, data.teksAsli, data.sumber, data.caraInput, waktu.toISOString()],
  });
  return (await ambilTransaksi(db, penggunaId, Number(res.lastInsertRowid)))!;
}

// ---------- mencatat dari teks ----------

/**
 * Aturan memori untuk satu item: dipakai saat menyimpan (catatTeks) dan saat pratinjau
 * input suara, supaya kartu pratinjau selalu sama dengan yang nanti tersimpan.
 */
export function aturItem(item: ItemTerbaca, m: EntriMemori | null): { jenis: Jenis; kategoriId: number | null; dariMemori: boolean } {
  // Memori dipakai kalau tidak bertentangan dengan tanda +.
  if (m && (!item.jenisPasti || item.jenisPasti === m.jenis)) return { jenis: m.jenis, kategoriId: m.kategoriId, dariMemori: true };
  return { jenis: item.jenisPasti ?? "pengeluaran", kategoriId: null, dariMemori: false };
}

export interface ItemPratinjau {
  deskripsi: string;
  nominal: number;
  jenis: Jenis;
  kategori: Transaksi["kategori"];
  perluTanya: boolean;
}

export type HasilPratinjau =
  | { ok: true; tanggal: string; items: ItemPratinjau[] }
  | { ok: false; alasan: AlasanGagalBaca };

/** Apa yang AKAN tersimpan dari teks ini (kartu hasil input suara). Tidak menulis apa pun. */
export async function pratinjauTeks(deps: Deps, teks: string): Promise<HasilPratinjau> {
  const baca = bacaInput(teks, deps.sekarang?.() ?? new Date());
  if (!baca.ok) return baca;
  const { db, penggunaId } = deps;
  const [kategori, cocok] = await Promise.all([
    daftarKategori(db, penggunaId),
    Promise.all(baca.items.map((item) => cariMemori(db, penggunaId, item.deskripsi))),
  ]);
  return {
    ok: true,
    tanggal: baca.tanggal,
    items: baca.items.map((item, i) => {
      const a = aturItem(item, cocok[i]);
      const k = kategori.find((x) => x.id === a.kategoriId);
      return {
        deskripsi: item.deskripsi, nominal: item.nominal, jenis: a.jenis,
        kategori: k ? { id: k.id, nama: k.nama, ikon: k.ikon } : null,
        perluTanya: a.jenis !== "usaha" && !k,
      };
    }),
  };
}

/**
 * Catat dari teks ketikan atau hasil pengenal suara.
 * Input suara memakai alur yang sama; bedanya hanya dicatat sebagai cara_input "suara",
 * dan tampilan tidak langsung memunculkan panel tanya balik (dirapikan belakangan).
 */
export async function catatTeks(deps: Deps, teks: string, cara: "ketik" | "suara" = "ketik"): Promise<HasilCatat> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const baca = bacaInput(teks, sekarang);
  if (!baca.ok) return baca;

  const { db, penggunaId } = deps;
  const cekMemori = await Promise.all(baca.items.map((item) => cariMemori(db, penggunaId, item.deskripsi)));

  // Disimpan berurutan supaya id urut sesuai kalimat.
  const hasil: HasilItem[] = [];
  for (const [i, item] of baca.items.entries()) {
    const m = cekMemori[i];
    const a = aturItem(item, m);
    if (a.dariMemori) await tandaiDipakai(db, m!.id, sekarang);
    // Belum dikenal: tersimpan tanpa kategori, kategorinya ditanyakan (tanya balik).
    const trx = await sisipkan(db, penggunaId, {
      tanggal: baca.tanggal, nominal: item.nominal, deskripsi: item.deskripsi, teksAsli: teks.trim(), caraInput: cara,
      jenis: a.jenis, arah: arahUntuk(a.jenis, item.deskripsi), kategoriId: a.kategoriId,
      sumber: a.dariMemori ? "memori" : "tanya_balik",
    }, sekarang);
    hasil.push({ transaksi: trx, tanya: a.dariMemori ? null : { tanyaJenis: !item.jenisPasti } });
  }

  return { ok: true, tanggalDariTeks: baca.tanggalDariTeks, hasil };
}

export type HasilRapikan = { ok: true; teks: string } | { ok: false; alasan: "tanpa_nominal" | "tidak_tersedia" | "kuota" };

/**
 * Cadangan input suara: teks yang nominalnya tidak terbaca parser dikirim ke
 * Gemini untuk ditulis ulang. Yang dikirim hanya teks. Hasilnya harus lolos parser, kalau tidak
 * dianggap tetap tanpa nominal.
 */
export async function rapikanSuara(ai: LayananAI, teks: string): Promise<HasilRapikan> {
  const isi = teks.trim().slice(0, 500);
  if (!isi) return { ok: false, alasan: "tanpa_nominal" };
  const hasil = await ai.rapikanSuara(isi);
  if (!hasil.ok) return { ok: false, alasan: hasil.alasan === "kuota" ? "kuota" : "tidak_tersedia" };
  return hasil.data && bacaInput(hasil.data).ok ? { ok: true, teks: hasil.data } : { ok: false, alasan: "tanpa_nominal" };
}

// ---------- screenshot mutasi ----------

/**
 * Jenis + kategori untuk satu baris mutasi. Uang masuk selalu pemasukan; memori yang
 * bertentangan dengan arah uang di mutasi (mis. memori "gaji" tapi uangnya keluar) diabaikan.
 */
function aturMutasi(keterangan: string, nominal: number, arah: Arah, m: EntriMemori | null) {
  const a = aturItem({ deskripsi: keterangan, nominal, jenisPasti: arah === "masuk" ? "pemasukan" : null }, m);
  if (arah === "keluar" && a.jenis === "pemasukan") return { jenis: "pengeluaran" as Jenis, kategoriId: null, dariMemori: false };
  return a;
}

/** Hasil baca screenshot → baris layar periksa (kategori dari memori, sudah tercatat atau belum). */
export async function periksaMutasi(deps: Deps, baris: BarisMutasi[]): Promise<ItemPeriksa[]> {
  const { db, penggunaId } = deps;
  const kategori = await daftarKategori(db, penggunaId);
  return Promise.all(
    baris.map(async (b) => {
      const a = aturMutasi(b.keterangan, b.nominal, b.arah, await cariMemori(db, penggunaId, b.keterangan));
      const k = kategori.find((x) => x.id === a.kategoriId);
      const { rows } = await db.execute({
        sql: "SELECT 1 FROM transaksi WHERE pengguna_id = ? AND tanggal = ? AND nominal = ? AND arah = ? LIMIT 1",
        args: [penggunaId, b.tanggal, b.nominal, b.arah],
      });
      return { ...b, jenis: a.jenis, kategori: k ? { id: k.id, nama: k.nama, ikon: k.ikon } : null, tercatat: rows.length > 0 };
    }),
  );
}

export interface SimpanMutasi {
  tanggal: string;
  nominal: number;
  keterangan: string;
  arah: Arah;
  sumber: string;
  /** Kategori yang dipilih pengguna di layar periksa (opsional). Ikut diingat di memori. */
  kategoriId?: number | null;
}

/**
 * Simpan baris mutasi yang dicentang. Semua isian divalidasi ulang di server.
 * cara_input "import" (mutasi = impor dari aplikasi lain); nama aplikasinya di teks_asli.
 * Kategori: pilihan pengguna di layar periksa, kalau tidak ada dari memori, kalau tidak ada dibiarkan
 * kosong (penanda "belum dikategorikan"; tidak ditanyakan satu per satu).
 */
export async function catatMutasi(deps: Deps, items: SimpanMutasi[]): Promise<HasilItem[]> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const { db, penggunaId } = deps;
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) throw new KesalahanInput("Pilih 1 sampai 100 transaksi");
  const bersih = items.map((it) => ({
    tanggal: cekTanggal(it?.tanggal, sekarang),
    nominal: cekNominal(it?.nominal),
    keterangan: cekDeskripsi(it?.keterangan),
    arah: (it?.arah === "masuk" ? "masuk" : "keluar") as Arah,
    sumber: typeof it?.sumber === "string" ? it.sumber.trim().slice(0, 30) : "",
    kategoriId: it?.kategoriId == null ? null : Number(it.kategoriId),
  }));

  // Kategori pilihan harus boleh dipakai akun ini dan cocok dengan arah uangnya.
  const daftar = await daftarKategori(db, penggunaId);
  const pilihan = bersih.map((it) => {
    if (it.kategoriId === null) return null;
    const k = daftar.find((x) => x.id === it.kategoriId);
    if (!k) throw new KesalahanInput("Kategori tidak ditemukan");
    const cocok = it.arah === "masuk" ? k.jenis === "pemasukan" || k.jenis === "investasi" : k.jenis !== "pemasukan";
    if (!cocok) throw new KesalahanInput(`Kategori ${k.nama} tidak cocok dengan uang ${it.arah}`);
    return k;
  });

  const hasil: HasilItem[] = [];
  for (const [i, it] of bersih.entries()) {
    const k = pilihan[i];
    const m = k ? null : await cariMemori(db, penggunaId, it.keterangan);
    const a = k ? { jenis: k.jenis as Jenis, kategoriId: k.id, dariMemori: false } : aturMutasi(it.keterangan, it.nominal, it.arah, m);
    if (a.dariMemori) await tandaiDipakai(db, m!.id, sekarang);
    const trx = await sisipkan(db, penggunaId, {
      tanggal: it.tanggal, nominal: it.nominal, deskripsi: it.keterangan,
      teksAsli: `mutasi ${it.sumber || "?"}: ${it.keterangan}`, caraInput: "import",
      jenis: a.jenis, arah: a.jenis === "investasi" ? it.arah : arahUntuk(a.jenis, it.keterangan),
      kategoriId: a.kategoriId, sumber: a.dariMemori ? "memori" : "tanya_balik",
    }, sekarang);
    // Pilihan di layar periksa diingat, jadi screenshot berikutnya langsung dikenali.
    if (k) await simpanMemori(db, penggunaId, { deskripsi: it.keterangan, jenis: a.jenis, kategoriId: k.id, asal: "tanya_balik" }, sekarang);
    hasil.push({ transaksi: trx, tanya: a.kategoriId === null && a.jenis !== "usaha" ? { tanyaJenis: it.arah === "keluar" } : null });
  }
  return hasil;
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
  const { db, penggunaId } = deps;
  const lama = await ambilTransaksi(db, penggunaId, id);
  if (!lama) throw new KesalahanInput("Transaksi tidak ditemukan");
  const jenis = cekJenis(pilihan.jenis);
  const kategoriId = await tentukanKategori(db, penggunaId, jenis, pilihan);

  await db.execute({
    sql: "UPDATE transaksi SET jenis = ?, arah = ?, kategori_id = ?, sumber = 'tanya_balik' WHERE id = ? AND pengguna_id = ?",
    args: [jenis, arahUntuk(jenis, lama.deskripsi), kategoriId, id, penggunaId],
  });
  await simpanMemori(db, penggunaId, { deskripsi: lama.deskripsi, jenis, kategoriId, asal: "tanya_balik" }, sekarang);
  return (await ambilTransaksi(db, penggunaId, id))!;
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

/** Edit transaksi. Kalau jenis/kategori berubah, memori ikut diperbarui. */
export async function editTransaksi(deps: Deps, id: number, ubah: UbahTransaksi): Promise<Transaksi> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const { db, penggunaId } = deps;
  const lama = await ambilTransaksi(db, penggunaId, id);
  if (!lama) throw new KesalahanInput("Transaksi tidak ditemukan");

  const tanggal = ubah.tanggal !== undefined ? cekTanggal(ubah.tanggal, sekarang) : lama.tanggal;
  const nominal = ubah.nominal !== undefined ? cekNominal(ubah.nominal) : lama.nominal;
  const deskripsi = ubah.deskripsi !== undefined ? cekDeskripsi(ubah.deskripsi) : lama.deskripsi;
  const jenis = ubah.jenis !== undefined ? cekJenis(ubah.jenis) : lama.jenis;

  const gantiKategori = ubah.jenis !== undefined || ubah.kategoriId !== undefined || Boolean(ubah.kategoriBaru);
  const kategoriId = gantiKategori
    ? await tentukanKategori(db, penggunaId, jenis, {
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

  await db.execute({
    sql: `UPDATE transaksi SET tanggal = ?, nominal = ?, deskripsi = ?, jenis = ?, arah = ?, kategori_id = ?,
            sumber = ?, dikoreksi = CASE WHEN ? = 1 THEN 1 ELSE dikoreksi END
          WHERE id = ? AND pengguna_id = ?`,
    args: [tanggal, nominal, deskripsi, jenis, arah, kategoriId, sumber, koreksi ? 1 : 0, id, penggunaId],
  });
  const lengkap = jenis === "usaha" || kategoriId !== null;
  if (lengkap && (berubah || deskripsi !== lama.deskripsi)) {
    await simpanMemori(db, penggunaId, { deskripsi, jenis, kategoriId, asal: koreksi ? "koreksi" : "tanya_balik" }, sekarang);
  }
  return (await ambilTransaksi(db, penggunaId, id))!;
}

export interface TransaksiManual extends PilihanKategori {
  tanggal: string;
  nominal: number;
  deskripsi: string;
  arah?: Arah;
}

/** Form manual: semua isian dari pengguna, ikut diingat di memori. */
export async function tambahManual(deps: Deps, data: TransaksiManual): Promise<Transaksi> {
  const sekarang = deps.sekarang?.() ?? new Date();
  const tanggal = cekTanggal(data.tanggal, sekarang);
  const nominal = cekNominal(data.nominal);
  const deskripsi = cekDeskripsi(data.deskripsi);
  const jenis = cekJenis(data.jenis);
  const kategoriId = await tentukanKategori(deps.db, deps.penggunaId, jenis, data);
  const arah = jenis === "investasi" ? (data.arah ?? arahUntuk(jenis, deskripsi)) : arahUntuk(jenis, deskripsi);

  const trx = await sisipkan(deps.db, deps.penggunaId, {
    tanggal, nominal, jenis, arah, kategoriId, deskripsi, teksAsli: deskripsi, sumber: "manual", caraInput: "form",
  }, sekarang);
  await simpanMemori(deps.db, deps.penggunaId, { deskripsi, jenis, kategoriId, asal: "manual" }, sekarang);
  return trx;
}

export async function hapusTransaksi(db: Client, penggunaId: number, id: number): Promise<boolean> {
  const res = await db.execute({ sql: "DELETE FROM transaksi WHERE id = ? AND pengguna_id = ?", args: [id, penggunaId] });
  return res.rowsAffected > 0;
}

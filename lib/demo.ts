// Gudang mode demo: semua data pengunjung disimpan di browser mereka (localStorage),
// tidak pernah masuk database. AI hanya dipanggil lewat /api/demo/suara (berkuota),
// sebagai cadangan input suara. Aturan sama dengan mode pribadi: parser → memori → tanya balik.
import type { Gudang } from "./gudang";
import type { Kategori } from "./kategori";
import { KATEGORI_BAWAAN } from "./kategori-bawaan";
import { cocokkan, normalisasi, type EntriMemori } from "./memori";
import { bacaInput, type Jenis } from "./parser";
import { arahUntuk, aturItem, type CaraInput, type HasilItem, type PilihanKategori, type Sumber, type Transaksi } from "./transaksi";

const KUNCI = "financial-detector-demo-v1";

const KATEGORI_DEMO: Kategori[] = KATEGORI_BAWAAN.map((k, i) => ({ id: i + 1, ...k, buatanPengguna: false }));
const idDari = (nama: string) => KATEGORI_DEMO.find((k) => k.nama === nama)!.id;

/** Memori umum bawaan (docs/KEPUTUSAN.md no. 4). "rasela" sengaja tidak ada. */
const MEMORI_BAWAAN: [string, Jenis, string | null][] = [
  ["warteg", "pengeluaran", "Makanan & Minuman"], ["makan", "pengeluaran", "Makanan & Minuman"],
  ["nasgor", "pengeluaran", "Makanan & Minuman"], ["kopi", "pengeluaran", "Makanan & Minuman"],
  ["bensin", "pengeluaran", "Transportasi"], ["parkir", "pengeluaran", "Transportasi"], ["ojol", "pengeluaran", "Transportasi"],
  ["kuota", "pengeluaran", "Pulsa & Internet"], ["pulsa", "pengeluaran", "Pulsa & Internet"],
  ["listrik", "pengeluaran", "Tagihan & Rumah"], ["netflix", "pengeluaran", "Langganan"],
  ["indomaret", "pengeluaran", "Belanja"], ["alfamart", "pengeluaran", "Belanja"], ["gopay", "pengeluaran", "Top up"],
  ["gaji", "pemasukan", "Gaji"],
];

interface DataDemo {
  transaksi: Transaksi[];
  memori: EntriMemori[];
  kategoriBaru: Kategori[];
  idBerikut: number;
}

function dataAwal(): DataDemo {
  return {
    transaksi: [],
    memori: MEMORI_BAWAAN.map(([kataKunci, jenis, kat], i) => ({ id: i + 1, kataKunci, jenis, kategoriId: kat ? idDari(kat) : null })),
    kategoriBaru: [],
    idBerikut: 1,
  };
}

function muat(): DataDemo {
  try {
    const isi = localStorage.getItem(KUNCI);
    if (isi) return JSON.parse(isi) as DataDemo;
  } catch {
    // localStorage tidak tersedia / rusak → mulai baru
  }
  return dataAwal();
}

export interface OpsiDemo {
  hariIni: () => string;
  /** Dipanggil setiap server memberi tahu sisa kuota AI. */
  padaKuota: (sisa: number) => void;
}

export function buatGudangDemo(opsi: OpsiDemo): Gudang {
  let data: DataDemo | null = null;
  const d = () => (data ??= muat());
  const simpan = () => {
    try {
      localStorage.setItem(KUNCI, JSON.stringify(d()));
    } catch {
      // penuh / diblokir: data tetap ada selama halaman terbuka
    }
  };
  const semuaKategori = () => [...KATEGORI_DEMO, ...d().kategoriBaru];
  const ringkasKategori = (id: number | null) => {
    const k = semuaKategori().find((x) => x.id === id);
    return k ? { id: k.id, nama: k.nama, ikon: k.ikon } : null;
  };

  function ingat(deskripsi: string, jenis: Jenis, kategoriId: number | null) {
    const kunci = normalisasi(deskripsi);
    if (!kunci) return;
    const lama = d().memori.find((m) => m.kataKunci === kunci);
    const id = jenis === "usaha" ? null : kategoriId;
    if (lama) Object.assign(lama, { jenis, kategoriId: id });
    else d().memori.push({ id: d().memori.length + 1, kataKunci: kunci, jenis, kategoriId: id });
  }

  function tentukan(jenis: Jenis, p: { kategoriId?: number | null; kategoriBaru?: string | null }): number | null {
    if (jenis === "usaha") return null;
    const baru = p.kategoriBaru?.trim().replace(/\s+/g, " ");
    if (baru) {
      const ada = semuaKategori().find((k) => k.jenis === jenis && k.nama.toLowerCase() === baru.toLowerCase());
      if (ada) return ada.id;
      const k: Kategori = { id: 1000 + d().kategoriBaru.length, nama: baru.slice(0, 40), jenis: jenis as Kategori["jenis"], ikon: "lainnya", buatanPengguna: true };
      d().kategoriBaru.push(k);
      return k.id;
    }
    const k = semuaKategori().find((x) => x.id === p.kategoriId);
    if (!k || k.jenis !== jenis) throw new Error("Pilih kategori yang sesuai");
    return k.id;
  }

  function buat(
    t: Omit<Transaksi, "id" | "kategori" | "perluTanya" | "dikoreksi" | "dibuatPada" | "caraInput"> & { kategoriId: number | null; caraInput?: CaraInput },
  ): Transaksi {
    const { kategoriId, caraInput, ...isi } = t;
    const trx: Transaksi = {
      ...isi,
      caraInput: caraInput ?? "ketik",
      id: d().idBerikut++,
      kategori: ringkasKategori(kategoriId),
      perluTanya: kategoriId === null && t.jenis !== "usaha",
      dikoreksi: false,
      dibuatPada: new Date().toISOString(),
    };
    d().transaksi.push(trx);
    return trx;
  }

  function ganti(id: number, ubah: Partial<Transaksi> & { kategoriId?: number | null }): Transaksi {
    const t = d().transaksi.find((x) => x.id === id);
    if (!t) throw new Error("Transaksi tidak ditemukan");
    const { kategoriId, ...isi } = ubah;
    Object.assign(t, isi);
    if (kategoriId !== undefined) t.kategori = ringkasKategori(kategoriId);
    t.perluTanya = !t.kategori && t.jenis !== "usaha";
    return { ...t };
  }

  return {
    mode: "demo",

    async kategori() {
      return semuaKategori();
    },

    async transaksiBulan(bulan) {
      return d().transaksi.filter((t) => t.tanggal.startsWith(bulan)).map((t) => ({ ...t }));
    },

    async catat(teks, cara = "ketik") {
      const baca = bacaInput(teks);
      if (!baca.ok) return baca;
      const hasil: HasilItem[] = [];
      for (const item of baca.items) {
        const dasar = { tanggal: baca.tanggal, nominal: item.nominal, deskripsi: item.deskripsi, caraInput: cara };
        const a = aturItem(item, cocokkan(item.deskripsi, d().memori));
        const trx = buat({
          ...dasar, jenis: a.jenis, arah: arahUntuk(a.jenis, item.deskripsi), kategoriId: a.kategoriId,
          sumber: a.dariMemori ? "memori" : "tanya_balik",
        });
        hasil.push({ transaksi: trx, tanya: a.dariMemori ? null : { tanyaJenis: !item.jenisPasti } });
      }
      simpan();
      return { ok: true, tanggalDariTeks: baca.tanggalDariTeks, hasil };
    },

    async pratinjau(teks) {
      const baca = bacaInput(teks);
      if (!baca.ok) return baca;
      return {
        ok: true,
        tanggal: baca.tanggal,
        items: baca.items.map((item) => {
          const a = aturItem(item, cocokkan(item.deskripsi, d().memori));
          const kategori = ringkasKategori(a.kategoriId);
          return { deskripsi: item.deskripsi, nominal: item.nominal, jenis: a.jenis, kategori, perluTanya: a.jenis !== "usaha" && !kategori };
        }),
      };
    },

    async rapikanSuara(teks) {
      try {
        const res = await fetch("/api/demo/suara", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teks }),
        });
        const hasil = await res.json();
        if (typeof hasil.sisa === "number") opsi.padaKuota(hasil.sisa);
        return hasil.ok ? { ok: true, teks: String(hasil.teks) } : { ok: false, alasan: hasil.alasan ?? "tidak_tersedia" };
      } catch {
        return { ok: false, alasan: "tidak_tersedia" };
      }
    },

    async jawab(id, pilihan: PilihanKategori) {
      const t = d().transaksi.find((x) => x.id === id);
      if (!t) throw new Error("Transaksi tidak ditemukan");
      const kategoriId = tentukan(pilihan.jenis, pilihan);
      const hasil = ganti(id, { jenis: pilihan.jenis, arah: arahUntuk(pilihan.jenis, t.deskripsi), kategoriId, sumber: "tanya_balik" });
      ingat(t.deskripsi, pilihan.jenis, kategoriId);
      simpan();
      return hasil;
    },

    async edit(id, ubah) {
      const t = d().transaksi.find((x) => x.id === id);
      if (!t) throw new Error("Transaksi tidak ditemukan");
      if (ubah.tanggal && ubah.tanggal > opsi.hariIni()) throw new Error("Tanggal masa depan tidak boleh");
      const jenis = ubah.jenis ?? t.jenis;
      const kategoriId = tentukan(jenis, { kategoriId: ubah.kategoriId ?? t.kategori?.id ?? null, kategoriBaru: ubah.kategoriBaru });
      const berubah = jenis !== t.jenis || kategoriId !== (t.kategori?.id ?? null);
      const deskripsi = ubah.deskripsi?.trim() || t.deskripsi;
      const arah = jenis === "investasi" ? (ubah.arah ?? t.arah) : arahUntuk(jenis, deskripsi);
      const sumber: Sumber = t.perluTanya && berubah ? "tanya_balik" : t.sumber;
      const hasil = ganti(id, {
        tanggal: ubah.tanggal ?? t.tanggal, nominal: ubah.nominal ?? t.nominal, deskripsi, jenis, arah, kategoriId, sumber,
        dikoreksi: t.dikoreksi || (berubah && !t.perluTanya),
      });
      ingat(deskripsi, jenis, kategoriId);
      simpan();
      return hasil;
    },

    async tambahManual(data) {
      if (data.tanggal > opsi.hariIni()) throw new Error("Tanggal masa depan tidak boleh");
      const kategoriId = tentukan(data.jenis, data);
      const arah = data.jenis === "investasi" ? (data.arah ?? "keluar") : arahUntuk(data.jenis, data.deskripsi);
      const trx = buat({ tanggal: data.tanggal, nominal: data.nominal, deskripsi: data.deskripsi, jenis: data.jenis, arah, kategoriId, sumber: "manual", caraInput: "form" });
      ingat(data.deskripsi, data.jenis, kategoriId);
      simpan();
      return trx;
    },

    async hapus(id) {
      d().transaksi = d().transaksi.filter((t) => t.id !== id);
      simpan();
    },
  };
}

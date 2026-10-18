// "Gudang" = tempat data transaksi di sisi browser.
// - Mode pribadi: lewat API (database Turso).
// - Mode demo (Tahap 7): disimpan di browser pengunjung.
// Komponen tampilan hanya mengenal interface ini, jadi tampilannya sama untuk kedua mode.
import type { Kategori } from "./kategori";
import type { HasilCatat, HasilPratinjau, HasilRapikan, PilihanKategori, Transaksi, TransaksiManual, UbahTransaksi } from "./transaksi";

export interface Gudang {
  mode: "pribadi" | "demo";
  kategori(): Promise<Kategori[]>;
  transaksiBulan(bulan: string): Promise<Transaksi[]>;
  catat(teks: string, cara?: "ketik" | "suara"): Promise<HasilCatat>;
  /** Kartu hasil input suara: apa yang akan tersimpan, tanpa menyimpan. */
  pratinjau(teks: string): Promise<HasilPratinjau>;
  /** Cadangan input suara saat nominal tidak terbaca (memakai kuota AI). */
  rapikanSuara(teks: string): Promise<HasilRapikan>;
  jawab(id: number, pilihan: PilihanKategori): Promise<Transaksi>;
  edit(id: number, ubah: UbahTransaksi): Promise<Transaksi>;
  tambahManual(data: TransaksiManual): Promise<Transaksi>;
  hapus(id: number): Promise<void>;
}

export class GagalSimpan extends Error {}

/** Server menjawab 401: belum/tidak lagi login. Komponen mengarahkan ke halaman masuk. */
export class SesiBerakhir extends GagalSimpan {
  constructor() {
    super("Sesi berakhir, silakan masuk lagi");
  }
}

async function minta<T>(url: string, opsi: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opsi,
    headers: opsi.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (res.status === 401) throw new SesiBerakhir();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  // 422 dari /api/catat tetap berisi HasilCatat { ok: false, alasan }.
  if (!res.ok && res.status !== 422) throw new GagalSimpan(data.error ?? `Gagal (${res.status})`);
  return data as T;
}

const kirim = (body: unknown, method = "POST"): RequestInit => ({ method, body: JSON.stringify(body) });

/** Bungkus gudang: kalau ada panggilan yang kena SesiBerakhir, jalankan `keMasuk` (pindah ke /masuk). */
export function denganSesi(gudang: Gudang, keMasuk: () => void): Gudang {
  const jaga = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof SesiBerakhir) keMasuk();
      throw e;
    }
  };
  return {
    mode: gudang.mode,
    kategori: jaga(gudang.kategori),
    transaksiBulan: jaga(gudang.transaksiBulan),
    catat: jaga(gudang.catat),
    pratinjau: jaga(gudang.pratinjau),
    rapikanSuara: jaga(gudang.rapikanSuara),
    jawab: jaga(gudang.jawab),
    edit: jaga(gudang.edit),
    tambahManual: jaga(gudang.tambahManual),
    hapus: jaga(gudang.hapus),
  };
}

export const gudangServer: Gudang = {
  mode: "pribadi",
  kategori: () => minta("/api/kategori"),
  transaksiBulan: (bulan) => minta(`/api/transaksi?bulan=${bulan}`),
  catat: (teks, cara = "ketik") => minta("/api/catat", kirim({ teks, cara })),
  pratinjau: (teks) => minta("/api/pratinjau", kirim({ teks })),
  rapikanSuara: (teks) => minta("/api/suara", kirim({ teks })),
  jawab: (id, pilihan) => minta(`/api/transaksi/${id}/jawab`, kirim(pilihan)),
  edit: (id, ubah) => minta(`/api/transaksi/${id}`, kirim(ubah, "PATCH")),
  tambahManual: (data) => minta("/api/transaksi", kirim(data)),
  hapus: (id) => minta(`/api/transaksi/${id}`, { method: "DELETE" }),
};

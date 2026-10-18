"use client";
// Upload screenshot mutasi (docs/KEPUTUSAN.md 42+): menu tombol garis tiga, baca tiap screenshot
// lewat Gemini, lalu layar periksa. Top up, yang sudah tercatat, dan yang dobel antar screenshot
// awalnya tidak dicentang. Kategori dari memori; yang belum dikenal ditanyakan setelah disimpan.
import { useEffect, useRef, useState } from "react";
import { rupiah, tanggalPendek } from "@/lib/format";
import { kecilkanGambar } from "@/lib/gambar";
import type { Gudang } from "@/lib/gudang";
import { tandaiPeriksa, type BarisPeriksa, type ItemPeriksa } from "@/lib/mutasi";
import type { HasilItem } from "@/lib/transaksi";
import { Ikon } from "./Ikon";
import { LembarBawah } from "./Lembar";

/** Menu dari tombol garis tiga: upload mutasi atau form manual. */
export function MenuInput({ onMutasi, onManual, onTutup }: { onMutasi: (berkas: File[]) => void; onManual: () => void; onTutup: () => void }) {
  const pilih = useRef<HTMLInputElement>(null);
  return (
    <LembarBawah judul="Tambah transaksi" onTutup={onTutup}>
      <div className="menu-input">
        <button type="button" className="menu-pilihan" onClick={() => pilih.current?.click()}>
          <Ikon nama="gambar" ukuran={20} />
          <span>
            Upload screenshot mutasi
            <small>BCA, blu, GoPay, Grab, ShopeePay, dan lainnya</small>
          </span>
        </button>
        <button type="button" className="menu-pilihan" onClick={onManual}>
          <Ikon nama="pensil" ukuran={20} />
          <span>Isi form manual</span>
        </button>
        <input
          ref={pilih}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const berkas = [...(e.target.files ?? [])];
            if (berkas.length) onMutasi(berkas.slice(0, 10));
          }}
        />
      </div>
    </LembarBawah>
  );
}

const KETERANGAN_ALASAN = {
  isi_saldo: "top up, tidak dihitung",
  tercatat: "sudah tercatat",
  dobel: "sama dengan",
} as const;

type Tahap =
  | { nama: "membaca"; ke: number; dari: number }
  | { nama: "periksa"; baris: BarisPeriksa[]; gagal: number }
  | { nama: "galat"; pesan: string };

interface Props {
  berkas: File[];
  gudang: Gudang;
  onSelesai: (hasil: HasilItem[]) => void;
  onTutup: () => void;
}

export function LembarMutasi({ berkas, gudang, onSelesai, onTutup }: Props) {
  const [tahap, setTahap] = useState<Tahap>({ nama: "membaca", ke: 1, dari: berkas.length });
  const [sibuk, setSibuk] = useState(false);
  const [galatSimpan, setGalatSimpan] = useState<string | null>(null);

  // Baca screenshot satu per satu (satu request per gambar, supaya tidak melewati batas ukuran).
  useEffect(() => {
    let batal = false;
    (async () => {
      const semua: ItemPeriksa[] = [];
      let gagal = 0;
      for (const [i, f] of berkas.entries()) {
        if (batal) return;
        setTahap({ nama: "membaca", ke: i + 1, dari: berkas.length });
        try {
          const hasil = await gudang.bacaMutasi!(await kecilkanGambar(f));
          if (hasil.ok) semua.push(...hasil.items.map((it) => ({ ...it, gambar: i })));
          else if (hasil.alasan === "kuota") {
            if (!semua.length) return setTahap({ nama: "galat", pesan: "Kuota AI hari ini habis. Coba lagi besok." });
            gagal += berkas.length - i;
            break;
          } else gagal++;
        } catch {
          gagal++;
        }
      }
      if (batal) return;
      if (!semua.length) {
        setTahap({ nama: "galat", pesan: gagal ? "Screenshot gagal dibaca. Coba lagi." : "Tidak ada transaksi yang terbaca di screenshot ini." });
        return;
      }
      setTahap({ nama: "periksa", baris: tandaiPeriksa(semua), gagal });
    })();
    return () => {
      batal = true;
    };
  }, [berkas, gudang]);

  function ubahCentang(i: number) {
    if (tahap.nama !== "periksa") return;
    setTahap({ ...tahap, baris: tahap.baris.map((b, j) => (j === i ? { ...b, centang: !b.centang } : b)) });
  }

  async function simpan() {
    if (tahap.nama !== "periksa") return;
    const dipilih = tahap.baris.filter((b) => b.centang);
    if (!dipilih.length) return;
    setSibuk(true);
    setGalatSimpan(null);
    try {
      const hasil = await gudang.simpanMutasi!(
        dipilih.map((b) => ({ tanggal: b.tanggal, nominal: b.nominal, keterangan: b.keterangan, arah: b.arah, sumber: b.sumber })),
      );
      onSelesai(hasil);
    } catch (err) {
      setGalatSimpan(err instanceof Error ? err.message : "Gagal menyimpan, coba lagi");
      setSibuk(false);
    }
  }

  const dicentang = tahap.nama === "periksa" ? tahap.baris.filter((b) => b.centang).length : 0;
  const sumber = tahap.nama === "periksa" ? [...new Set(tahap.baris.map((b) => b.sumber).filter(Boolean))].join(", ") : "";

  return (
    <LembarBawah judul="Upload mutasi" onTutup={onTutup}>
      <div className="form-kepala">
        <span className="form-judul">
          {tahap.nama === "periksa" ? `Periksa ${tahap.baris.length} transaksi` : "Upload mutasi"}
        </span>
        <button type="button" className="tombol-bulat" aria-label="Tutup" onClick={onTutup}>
          <Ikon nama="tutup" ukuran={18} tebal={2.2} />
        </button>
      </div>

      {tahap.nama === "membaca" && (
        <div className="mutasi-membaca" role="status" aria-busy="true">
          <Ikon nama="memproses" ukuran={28} tebal={2.4} className="berputar" />
          <span>Membaca mutasi{tahap.dari > 1 ? ` (${tahap.ke} dari ${tahap.dari})` : ""}…</span>
          <small>Gambar tidak disimpan</small>
        </div>
      )}

      {tahap.nama === "galat" && <p className="galat" role="alert">{tahap.pesan}</p>}

      {tahap.nama === "periksa" && (
        <>
          <p className="mutasi-sub">
            {sumber}
            {tahap.gagal > 0 && <span className="mutasi-peringatan"> · {tahap.gagal} screenshot gagal dibaca</span>}
          </p>
          <ul className="mutasi-daftar">
            {tahap.baris.map((b, i) => (
              <li key={i}>
                <label className={b.centang ? "mutasi-baris" : "mutasi-baris redup"}>
                  <input type="checkbox" checked={b.centang} onChange={() => ubahCentang(i)} />
                  <span className="mutasi-isi">
                    <span className="mutasi-keterangan">{b.keterangan}</span>
                    <span className="mutasi-detail">
                      {tanggalPendek(b.tanggal)}
                      {" · "}
                      {b.jenis === "pemasukan" && !b.kategori ? "pemasukan" : (b.kategori?.nama ?? <span className="mutasi-peringatan">belum ada kategori</span>)}
                      {b.pending && <span className="mutasi-peringatan"> · pending</span>}
                    </span>
                    {b.alasan && (
                      <span className="mutasi-peringatan">
                        {KETERANGAN_ALASAN[b.alasan]}
                        {b.alasan === "dobel" && b.samaDengan ? ` ${b.samaDengan}` : ""}
                      </span>
                    )}
                  </span>
                  <span className={b.arah === "masuk" ? "trx-nominal masuk num" : "trx-nominal num"}>
                    {b.arah === "masuk" ? "+" : ""}
                    {rupiah(b.nominal)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {galatSimpan && <p className="galat" role="alert">{galatSimpan}</p>}
          <button type="button" className="tombol-utama besar" disabled={!dicentang || sibuk} onClick={simpan}>
            {sibuk ? "Menyimpan…" : dicentang ? `Simpan ${dicentang} transaksi` : "Pilih transaksi dulu"}
          </button>
        </>
      )}
    </LembarBawah>
  );
}

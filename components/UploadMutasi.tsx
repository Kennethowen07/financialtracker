"use client";
// Upload screenshot mutasi (docs/KEPUTUSAN.md 42+): menu tombol garis tiga, baca tiap screenshot
// lewat Gemini, lalu layar periksa. Top up, yang sudah tercatat, dan yang dobel antar screenshot
// awalnya tidak dicentang. Kategori dari memori; yang belum dikenal ditanyakan setelah disimpan.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rupiah, tanggalPendek } from "@/lib/format";
import { kecilkanGambar } from "@/lib/gambar";
import type { Gudang } from "@/lib/gudang";
import type { Kategori } from "@/lib/kategori";
import { tandaiPeriksa, type BarisPeriksa, type ItemPeriksa } from "@/lib/mutasi";
import type { HasilItem } from "@/lib/transaksi";
import { Ikon } from "./Ikon";
import { GridKategori, LembarBawah } from "./Lembar";

interface PropsMenu {
  onMutasi: (berkas: File[]) => void;
  onManual: () => void;
  onTutup: () => void;
  /** Mode demo: upload mutasi tampil tapi nonaktif, dan menekannya memunculkan ajakan login. */
  perluLogin?: boolean;
}

/** Menu dari tombol garis tiga: upload mutasi atau form manual. */
export function MenuInput({ onMutasi, onManual, onTutup, perluLogin = false }: PropsMenu) {
  const pilih = useRef<HTMLInputElement>(null);
  const [ajakLogin, setAjakLogin] = useState(false);
  return (
    <LembarBawah judul="Tambah transaksi" onTutup={onTutup}>
      <div className="menu-input">
        <button
          type="button"
          className={perluLogin ? "menu-pilihan nonaktif" : "menu-pilihan"}
          aria-disabled={perluLogin}
          onClick={() => (perluLogin ? setAjakLogin(true) : pilih.current?.click())}
        >
          <Ikon nama="gambar" ukuran={20} />
          <span>
            Upload screenshot mutasi
            <small>{perluLogin ? "Memerlukan login dengan akun Google" : "BCA, blu, GoPay, Grab, ShopeePay, dan lainnya"}</small>
          </span>
          {perluLogin && <Ikon nama="kunci" ukuran={16} />}
        </button>
        {ajakLogin && (
          <div className="menu-ajak-login" role="alert">
            <p>Silakan masuk dengan akun Google terlebih dahulu untuk menggunakan fitur ini.</p>
            <Link href="/masuk" className="tombol-utama">
              Masuk dengan Google
            </Link>
          </div>
        )}
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
  /** Daftar kategori akun ini, untuk tombol ubah kategori per baris. */
  kategori: Kategori[];
  onSelesai: (hasil: HasilItem[]) => void;
  onTutup: () => void;
}

export function LembarMutasi({ berkas, gudang, kategori, onSelesai, onTutup }: Props) {
  const [tahap, setTahap] = useState<Tahap>({ nama: "membaca", ke: 1, dari: berkas.length });
  /** Baris yang sedang dibuka pilihan kategorinya. */
  const [buka, setBuka] = useState<number | null>(null);
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

  function ubahBaris(i: number, ubah: (b: BarisPeriksa) => BarisPeriksa) {
    if (tahap.nama !== "periksa") return;
    setTahap({ ...tahap, baris: tahap.baris.map((b, j) => (j === i ? ubah(b) : b)) });
  }

  /** Pilih kategori di layar periksa: baris ikut dicentang, dan pilihan diingat saat disimpan. */
  function pilihKategori(i: number, k: Kategori) {
    ubahBaris(i, (b) => ({ ...b, kategori: { id: k.id, nama: k.nama, ikon: k.ikon }, jenis: k.jenis, dipilih: true, centang: true }));
    setBuka(null);
  }

  async function simpan() {
    if (tahap.nama !== "periksa") return;
    const dipilih = tahap.baris.filter((b) => b.centang);
    if (!dipilih.length) return;
    setSibuk(true);
    setGalatSimpan(null);
    try {
      const hasil = await gudang.simpanMutasi!(
        dipilih.map((b) => ({
          tanggal: b.tanggal, nominal: b.nominal, keterangan: b.keterangan, arah: b.arah, sumber: b.sumber,
          // Hanya kategori yang dipilih di sini yang dikirim; sisanya ditentukan memori di server.
          kategoriId: b.dipilih ? (b.kategori?.id ?? null) : null,
        })),
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
                <div className={b.centang ? "mutasi-baris" : "mutasi-baris redup"}>
                  <input
                    id={`mutasi-${i}`}
                    type="checkbox"
                    checked={b.centang}
                    onChange={() => ubahBaris(i, (x) => ({ ...x, centang: !x.centang }))}
                  />
                  <span className="mutasi-isi">
                    <label htmlFor={`mutasi-${i}`} className="mutasi-keterangan">{b.keterangan}</label>
                    <span className="mutasi-detail">
                      {tanggalPendek(b.tanggal)}
                      {b.pending && <span className="mutasi-peringatan"> · pending</span>}
                    </span>
                    {b.alasan && (
                      <span className="mutasi-peringatan">
                        {KETERANGAN_ALASAN[b.alasan]}
                        {b.alasan === "dobel" && b.samaDengan ? ` ${b.samaDengan}` : ""}
                      </span>
                    )}
                    <button
                      type="button"
                      className={b.kategori ? "mutasi-kategori" : "mutasi-kategori kosong"}
                      aria-expanded={buka === i}
                      onClick={() => setBuka(buka === i ? null : i)}
                    >
                      <Ikon nama={b.kategori?.ikon ?? "tanya"} ukuran={14} />
                      {b.kategori?.nama ?? "Pilih kategori"}
                      <Ikon nama="bawah" ukuran={14} />
                    </button>
                  </span>
                  <span className={b.arah === "masuk" ? "trx-nominal masuk num" : "trx-nominal num"}>
                    {b.arah === "masuk" ? "+" : ""}
                    {rupiah(b.nominal)}
                  </span>
                </div>
                {buka === i && (
                  <div className="mutasi-pilih-kategori">
                    <GridKategori
                      kategori={kategori}
                      jenis={b.arah === "masuk" ? "pemasukan" : b.jenis === "investasi" ? "investasi" : "pengeluaran"}
                      terpilih={b.kategori?.id ?? null}
                      onPilih={(k) => pilihKategori(i, k)}
                    />
                  </div>
                )}
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

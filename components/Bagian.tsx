"use client";
// Bagian-bagian dashboard: kartu ringkasan, per minggu, per kategori, daftar transaksi,
// dan pemilih bulan. Tampilannya mengikuti docs/design/01 (HP) dan 05 (laptop).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { RingkasanBulan } from "@/lib/laporan";
import type { Transaksi } from "@/lib/transaksi";
import { BULAN_PENDEK, namaBulan, namaHari, persen, rupiah, tanggalPendek } from "@/lib/format";
import { Ikon } from "./Ikon";

// ---------- kartu ringkasan ----------

export function KartuRingkasan({ r }: { r: RingkasanBulan }) {
  const naik = (r.perubahanPersen ?? 0) > 0;
  return (
    <section className="ringkasan" aria-label="Ringkasan bulan">
      <div className="hero">
        <div className="hero-utama">
          <span className="hero-label">Pengeluaran</span>
          <div className="hero-baris">
            <span className="hero-nilai num">{rupiah(r.pengeluaran)}</span>
            {r.perubahanPersen !== null && r.perubahanPersen !== 0 && (
              <span
                className="chip-persen num"
                title={`Dibanding periode yang sama bulan lalu (${rupiah(r.pengeluaranBulanLalu)})`}
              >
                <Ikon nama={naik ? "naik" : "turun"} ukuran={12} tebal={2.5} />
                {persen(r.perubahanPersen)}
                <span className="sr-only">{naik ? "naik" : "turun"} dibanding periode yang sama bulan lalu</span>
              </span>
            )}
          </div>
        </div>
        {r.hariIni !== null && (
          <div className="hero-hari-ini">
            <span className="hero-label">Hari ini</span>
            <span className="hero-nilai-kecil num">{rupiah(r.hariIni)}</span>
          </div>
        )}
      </div>

      <div className="mini mini-masuk">
        <span className="mini-ikon"><Ikon nama="masuk" ukuran={15} tebal={2.2} /></span>
        <div className="mini-teks">
          <span className="mini-label">Masuk</span>
          <span className="mini-nilai num">{rupiah(r.masuk)}</span>
          <span className="mini-sisa-laptop">Sisa <span className="num">{rupiah(r.sisa)}</span></span>
        </div>
      </div>
      <div className="mini mini-sisa">
        <span className="mini-ikon"><Ikon nama="topup" ukuran={15} tebal={2.2} /></span>
        <div className="mini-teks">
          <span className="mini-label">Sisa</span>
          <span className="mini-nilai num">{rupiah(r.sisa)}</span>
        </div>
      </div>
      <div className="mini mini-investasi">
        <span className="mini-ikon"><Ikon nama="saham" ukuran={15} tebal={2.2} /></span>
        <div className="mini-teks">
          <span className="mini-label">Investasi</span>
          <span className="mini-investasi-baris num">
            <Ikon nama="keluar" ukuran={11} tebal={3} label="keluar" />
            {rupiah(r.investasiKeluar)}
          </span>
          <span className="mini-investasi-baris num">
            <Ikon nama="masuk" ukuran={11} tebal={3} label="masuk" />
            {rupiah(r.investasiMasuk)}
          </span>
        </div>
      </div>
    </section>
  );
}

// ---------- per minggu ----------

export function GrafikMinggu({ r }: { r: RingkasanBulan }) {
  const awal = r.mingguBerjalan ?? 3;
  const [pilihan, setPilihan] = useState<{ bulan: string; indeks: number }>({ bulan: r.bulan, indeks: awal });
  // Ganti bulan → kembali ke minggu berjalan (atau W4 untuk bulan yang sudah lewat).
  const pilih = pilihan.bulan === r.bulan ? pilihan.indeks : awal;
  const maks = Math.max(...r.minggu.map((m) => m.total), 1);

  return (
    <section className="kartu minggu" aria-label="Pengeluaran per minggu">
      <h2 className="kartu-judul">Per minggu</h2>
      <div className="minggu-grafik">
        {r.minggu.map((m, i) => {
          const terpilih = i === pilih;
          return (
            <button
              key={m.label}
              type="button"
              className="minggu-batang"
              aria-pressed={terpilih}
              aria-label={`${m.label}, tanggal ${m.dari} sampai ${m.sampai}, ${rupiah(m.total)}`}
              onClick={() => setPilihan({ bulan: r.bulan, indeks: i })}
            >
              {terpilih && <span className="minggu-nilai num">{rupiah(m.total)}</span>}
              <span
                className={terpilih ? "minggu-isi terpilih" : "minggu-isi"}
                style={{ "--tinggi": m.total / maks } as CSSProperties}
              />
              <span className="minggu-label">{m.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------- per kategori ----------

export function PerKategori({ r }: { r: RingkasanBulan }) {
  const enam = r.perKategori.slice(0, 6);
  const maks = enam[0]?.total ?? 1;
  return (
    <section className="kartu per-kategori" aria-label="Pengeluaran per kategori">
      <h2 className="kartu-judul">Per kategori</h2>
      {enam.length === 0 && <p className="kosong-kecil">Belum ada pengeluaran.</p>}
      {enam.map((k, i) => (
        <div key={k.kategoriId ?? "kosong"} className="kat-baris">
          <span className="kat-nama">{k.nama}</span>
          <span className="kat-jalur">
            <span className={i === 0 ? "kat-isi pertama" : "kat-isi"} style={{ width: `${Math.max(3, (k.total / maks) * 100)}%` }} />
          </span>
          <span className="kat-nilai num">{rupiah(k.total)}</span>
        </div>
      ))}
    </section>
  );
}

// ---------- daftar transaksi ----------

/** Transaksi yang baru dikirim dan belum dibalas server (tampil "memproses"). */
export interface ItemSementara {
  kunci: string;
  deskripsi: string;
  nominal: number;
  tanggal: string;
}

interface PropsDaftar {
  transaksi: Transaksi[];
  sementara: ItemSementara[];
  hariIni: string;
  onPilih: (t: Transaksi) => void;
}

function IkonTransaksi({ t }: { t: Transaksi }) {
  if (t.perluTanya) {
    return (
      <span className="trx-ikon tanya" title="Belum ada kategori, ketuk untuk memilih">
        <Ikon nama="tanya" ukuran={17} label="Belum ada kategori" />
      </span>
    );
  }
  const nama = t.kategori?.ikon ?? (t.jenis === "usaha" ? "usaha" : "lainnya");
  return (
    <span className="trx-ikon" title={t.kategori?.nama ?? (t.jenis === "usaha" ? "Usaha" : undefined)}>
      <Ikon nama={nama} ukuran={17} />
    </span>
  );
}

/** Deskripsi + tanda kecil kalau dicatat lewat suara. */
function Deskripsi({ t }: { t: Transaksi }) {
  return (
    <span className="trx-deskripsi">
      {t.deskripsi}
      {t.caraInput === "suara" && (
        <span className="trx-suara" title="Dicatat lewat suara">
          <Ikon nama="mikrofon" ukuran={12} label="lewat suara" />
        </span>
      )}
    </span>
  );
}

function Nominal({ t }: { t: Transaksi }) {
  const masuk = t.arah === "masuk";
  return <span className={masuk ? "trx-nominal masuk num" : "trx-nominal num"}>{masuk ? "+" : ""}{rupiah(t.nominal)}</span>;
}

function BarisSementara({ s }: { s: ItemSementara }) {
  return (
    <div className="trx-baris" aria-busy="true">
      <span className="trx-ikon memproses">
        <Ikon nama="memproses" ukuran={16} tebal={2.4} label="Memproses" />
      </span>
      <span className="trx-deskripsi">{s.deskripsi}</span>
      <span className="trx-nominal num">{rupiah(s.nominal)}</span>
    </div>
  );
}

/** HP: dikelompokkan per hari (desain 01). */
export function DaftarPerHari({ transaksi, sementara, hariIni, onPilih }: PropsDaftar) {
  const hari = new Map<string, { transaksi: Transaksi[]; sementara: ItemSementara[] }>();
  for (const s of sementara) {
    const g = hari.get(s.tanggal) ?? { transaksi: [], sementara: [] };
    g.sementara.push(s);
    hari.set(s.tanggal, g);
  }
  for (const t of transaksi) {
    const g = hari.get(t.tanggal) ?? { transaksi: [], sementara: [] };
    g.transaksi.push(t);
    hari.set(t.tanggal, g);
  }
  const urut = [...hari.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="per-hari">
      {urut.map(([tanggal, g]) => {
        const total = g.transaksi.filter((t) => t.jenis === "pengeluaran").reduce((s, t) => s + t.nominal, 0)
          + g.sementara.reduce((s, x) => s + x.nominal, 0);
        return (
          <section key={tanggal} className="kartu hari" aria-label={namaHari(tanggal, hariIni)}>
            <div className="hari-kepala">
              <h2 className="kartu-judul">{namaHari(tanggal, hariIni)}</h2>
              <span className="hari-total num">{rupiah(total)}</span>
            </div>
            {g.sementara.map((s) => <BarisSementara key={s.kunci} s={s} />)}
            {g.transaksi.map((t) => (
              <button key={t.id} type="button" className="trx-baris" onClick={() => onPilih(t)}>
                <IkonTransaksi t={t} />
                <Deskripsi t={t} />
                <Nominal t={t} />
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Laptop: satu daftar dengan filter kategori (desain 05). */
export function TabelTransaksi({ transaksi, sementara, onPilih }: PropsDaftar) {
  const [filter, setFilter] = useState("");
  const kategori = [...new Map(transaksi.filter((t) => t.kategori).map((t) => [t.kategori!.id, t.kategori!.nama])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const tampil = transaksi.filter((t) => {
    if (!filter) return true;
    if (filter === "kosong") return t.perluTanya;
    return String(t.kategori?.id) === filter;
  });

  return (
    <section className="kartu tabel" aria-label="Transaksi">
      <div className="tabel-kepala">
        <h2 className="kartu-judul">Transaksi</h2>
        <label className="sr-only" htmlFor="filter-kat">Filter kategori</label>
        <select id="filter-kat" className="pilih" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Semua kategori</option>
          {kategori.map(([id, nama]) => <option key={id} value={String(id)}>{nama}</option>)}
          <option value="kosong">Belum dikategorikan</option>
        </select>
      </div>
      <div className="tabel-isi">
        {!filter && sementara.map((s) => (
          <div key={s.kunci} className="tabel-baris" aria-busy="true">
            <span className="tabel-tanggal">{tanggalPendek(s.tanggal)}</span>
            <span className="trx-ikon memproses"><Ikon nama="memproses" ukuran={16} tebal={2.4} label="Memproses" /></span>
            <span className="trx-deskripsi">{s.deskripsi}</span>
            <span className="trx-nominal num">{rupiah(s.nominal)}</span>
          </div>
        ))}
        {tampil.map((t) => (
          <button key={t.id} type="button" className="tabel-baris" onClick={() => onPilih(t)}>
            <span className="tabel-tanggal">{tanggalPendek(t.tanggal)}</span>
            <IkonTransaksi t={t} />
            <Deskripsi t={t} />
            <Nominal t={t} />
          </button>
        ))}
        {tampil.length === 0 && sementara.length === 0 && <p className="kosong-kecil">Belum ada transaksi.</p>}
      </div>
    </section>
  );
}

// ---------- pemilih bulan ----------

export function PemilihBulan({ bulan, bulanIni, onPilih }: { bulan: string; bulanIni: string; onPilih: (b: string) => void }) {
  const [buka, setBuka] = useState(false);
  const [tahun, setTahun] = useState(Number(bulan.slice(0, 4)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buka) return;
    const tutup = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener("mousedown", tutup);
    document.addEventListener("keydown", tutup);
    return () => {
      document.removeEventListener("mousedown", tutup);
      document.removeEventListener("keydown", tutup);
    };
  }, [buka]);

  return (
    <div className="pemilih-bulan" ref={ref}>
      <button
        type="button"
        className="judul-bulan"
        aria-expanded={buka}
        aria-haspopup="dialog"
        onClick={() => {
          setTahun(Number(bulan.slice(0, 4)));
          setBuka((b) => !b);
        }}
      >
        {namaBulan(bulan)}
        <Ikon nama="bawah" ukuran={18} />
      </button>
      {buka && (
        <div className="popover-bulan" role="dialog" aria-label="Pilih bulan">
          <div className="popover-tahun">
            <button type="button" className="tombol-bulat kecil" aria-label="Tahun sebelumnya" onClick={() => setTahun((t) => t - 1)}>
              <Ikon nama="kiri" ukuran={15} tebal={2.4} />
            </button>
            <span className="num">{tahun}</span>
            <button
              type="button"
              className="tombol-bulat kecil"
              aria-label="Tahun berikutnya"
              disabled={tahun >= Number(bulanIni.slice(0, 4))}
              onClick={() => setTahun((t) => t + 1)}
            >
              <Ikon nama="kanan" ukuran={15} tebal={2.4} />
            </button>
          </div>
          <div className="popover-grid">
            {BULAN_PENDEK.map((nama, i) => {
              const nilai = `${tahun}-${String(i + 1).padStart(2, "0")}`;
              return (
                <button
                  key={nama}
                  type="button"
                  className="popover-sel"
                  aria-pressed={nilai === bulan}
                  disabled={nilai > bulanIni}
                  onClick={() => {
                    onPilih(nilai);
                    setBuka(false);
                  }}
                >
                  {nama}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
// Panel yang muncul dari bawah (HP) / di tengah (laptop):
// - PanelTanya: tanya balik kategori & jenis (docs/design/02)
// - FormTransaksi: form manual (03) dan edit transaksi (04)
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Kategori } from "@/lib/kategori";
import type { Jenis } from "@/lib/parser";
import type { Arah, PilihanKategori, Transaksi, TransaksiManual } from "@/lib/transaksi";
import { IKON_UTAMA } from "@/lib/ikon";
import { labelTanggal, ribuan, rupiah } from "@/lib/format";
import { Ikon } from "./Ikon";

const PILIHAN_JENIS: { jenis: Jenis; label: string }[] = [
  { jenis: "pengeluaran", label: "Keluar" },
  { jenis: "pemasukan", label: "Masuk" },
  { jenis: "investasi", label: "Investasi" },
  { jenis: "usaha", label: "Usaha" },
];

// ---------- wadah ----------

function LembarBawah({ judul, onTutup, children }: { judul: string; onTutup: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onTutup]);

  return (
    <div className="lembar-latar" onMouseDown={(e) => e.target === e.currentTarget && onTutup()}>
      <div className="lembar" role="dialog" aria-modal="true" aria-label={judul}>
        <span className="lembar-pegangan" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

function PilihJenis({ nilai, onPilih }: { nilai: Jenis | null; onPilih: (j: Jenis) => void }) {
  return (
    <div className="segmen" role="group" aria-label="Jenis transaksi">
      {PILIHAN_JENIS.map((p) => (
        <button key={p.jenis} type="button" aria-pressed={nilai === p.jenis} onClick={() => onPilih(p.jenis)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Label pendek di bawah ikon (desain memakai "Makan", "Transport", dst.). */
function labelPendek(k: Kategori): string {
  const pendek: Record<string, string> = {
    "Makanan & Minuman": "Makan", Transportasi: "Transport", "Pulsa & Internet": "Pulsa", "Tagihan & Rumah": "Tagihan",
    "Sosial & Donasi": "Sosial", "Bonus & Hadiah": "Bonus", "Usaha & Penjualan": "Penjualan", "Pemasukan Lain": "Lainnya",
  };
  return pendek[k.nama] ?? k.nama;
}

function GridKategori({
  kategori, jenis, terpilih, onPilih, besar = false,
}: {
  kategori: Kategori[];
  jenis: Jenis;
  terpilih: number | null;
  onPilih: (k: Kategori) => void;
  besar?: boolean;
}) {
  const milikJenis = kategori.filter((k) => k.jenis === jenis);
  const utama = jenis === "pengeluaran"
    ? IKON_UTAMA.map((ikon) => milikJenis.find((k) => k.ikon === ikon && !k.buatanPengguna)).filter((k): k is Kategori => Boolean(k))
    : milikJenis;
  // Kategori terpilih yang bukan bagian dari 7 utama → langsung tampilkan semua.
  const [semua, setSemua] = useState(() => terpilih !== null && !utama.some((k) => k.id === terpilih));
  const tampil = semua || jenis !== "pengeluaran" ? milikJenis : utama;

  return (
    <div className={besar ? "grid-kategori besar" : "grid-kategori"}>
      {tampil.map((k) => (
        <button key={k.id} type="button" className="kat-tombol" aria-pressed={terpilih === k.id} onClick={() => onPilih(k)}>
          <span className="kat-bulat"><Ikon nama={k.ikon} ukuran={besar ? 22 : 21} /></span>
          <span className="kat-label">{labelPendek(k)}</span>
        </button>
      ))}
      {jenis === "pengeluaran" && !semua && (
        <button type="button" className="kat-tombol" onClick={() => setSemua(true)}>
          <span className="kat-bulat"><Ikon nama="semua" ukuran={besar ? 22 : 21} /></span>
          <span className="kat-label">Semua</span>
        </button>
      )}
    </div>
  );
}

// ---------- tanya balik ----------

interface PropsTanya {
  transaksi: Transaksi;
  tanyaJenis: boolean;
  kategori: Kategori[];
  onJawab: (pilihan: PilihanKategori) => Promise<void>;
  onTutup: () => void;
}

export function PanelTanya({ transaksi, tanyaJenis, kategori, onJawab, onTutup }: PropsTanya) {
  const [jenis, setJenis] = useState<Jenis>(transaksi.jenis);
  const [tersimpan, setTersimpan] = useState(false);
  const [mengetik, setMengetik] = useState(false);
  const [namaBaru, setNamaBaru] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function jawab(pilihan: PilihanKategori) {
    if (sibuk) return;
    setSibuk(true);
    setGalat("");
    try {
      await onJawab(pilihan);
      setTersimpan(true);
      setTimeout(onTutup, 1200);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan");
      setSibuk(false);
    }
  }

  function pilihJenis(j: Jenis) {
    setJenis(j);
    // Usaha tidak punya kategori, jadi langsung disimpan.
    if (j === "usaha") void jawab({ jenis: "usaha" });
  }

  return (
    <LembarBawah judul={tanyaJenis ? "Uang keluar atau masuk?" : "Masuk kategori apa?"} onTutup={onTutup}>
      <div className="tanya-kepala">
        <div>
          <span className="tanya-nama">{transaksi.deskripsi}</span>
          <span className="tanya-pertanyaan">{tanyaJenis ? "Uang keluar atau masuk?" : "Masuk kategori apa?"}</span>
        </div>
        <span className="tanya-nominal num">{rupiah(transaksi.nominal)}</span>
      </div>

      {tanyaJenis && <PilihJenis nilai={jenis} onPilih={pilihJenis} />}

      {jenis !== "usaha" && !tersimpan && (
        <GridKategori
          key={jenis}
          besar
          kategori={kategori}
          jenis={jenis}
          terpilih={null}
          onPilih={(k) => void jawab({ jenis, kategoriId: k.id })}
        />
      )}

      {tersimpan && (
        <p className="tanya-sukses" role="status">
          Tersimpan. {transaksi.deskripsi} akan dikenali otomatis.
        </p>
      )}
      {galat && <p className="galat" role="alert">{galat}</p>}

      {!tersimpan && jenis !== "usaha" && (mengetik ? (
        <form
          className="ketik-sendiri"
          onSubmit={(e) => {
            e.preventDefault();
            if (namaBaru.trim()) void jawab({ jenis, kategoriBaru: namaBaru });
          }}
        >
          <label className="sr-only" htmlFor="kategori-baru">Nama kategori baru</label>
          <input
            id="kategori-baru"
            className="isian"
            autoFocus
            maxLength={40}
            placeholder="Nama kategori baru"
            value={namaBaru}
            onChange={(e) => setNamaBaru(e.target.value)}
          />
          <button type="submit" className="tombol-utama" disabled={!namaBaru.trim() || sibuk}>Simpan</button>
        </form>
      ) : (
        <button type="button" className="tombol-garis" onClick={() => setMengetik(true)}>
          <Ikon nama="pensil" ukuran={16} />
          Ketik sendiri
        </button>
      ))}
    </LembarBawah>
  );
}

// ---------- form manual & edit ----------

const KETERANGAN_SUMBER: Record<Transaksi["sumber"], string> = {
  memori: "Dari memori",
  ai: "Tebakan AI",
  tanya_balik: "Dari tanya balik",
  manual: "Diisi manual",
  import: "Dari data lama",
};

interface PropsForm {
  /** Kosong = form manual (transaksi baru). */
  transaksi?: Transaksi;
  kategori: Kategori[];
  hariIni: string;
  onSimpan: (data: TransaksiManual) => Promise<void>;
  onHapus?: () => Promise<void>;
  onTutup: () => void;
}

export function FormTransaksi({ transaksi, kategori, hariIni, onSimpan, onHapus, onTutup }: PropsForm) {
  const edit = Boolean(transaksi);
  const [nominal, setNominal] = useState(transaksi ? ribuan(transaksi.nominal) : "");
  const [deskripsi, setDeskripsi] = useState(transaksi?.deskripsi ?? "");
  const [jenis, setJenis] = useState<Jenis>(transaksi?.jenis ?? "pengeluaran");
  const [arah, setArah] = useState<Arah>(transaksi?.arah ?? "keluar");
  const [kategoriId, setKategoriId] = useState<number | null>(transaksi?.kategori?.id ?? null);
  const [tanggal, setTanggal] = useState(transaksi?.tanggal ?? hariIni);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const inputTanggal = useRef<HTMLInputElement>(null);

  const angka = Number(nominal.replace(/\D/g, ""));
  const kategoriBerubah = edit && (jenis !== transaksi!.jenis || kategoriId !== (transaksi!.kategori?.id ?? null));
  const valid = angka > 0 && deskripsi.trim() && (jenis === "usaha" || kategoriId !== null);

  function gantiJenis(j: Jenis) {
    setJenis(j);
    // Kategori lama belum tentu cocok untuk jenis baru.
    if (!kategori.some((k) => k.id === kategoriId && k.jenis === j)) setKategoriId(null);
    setArah(j === "pemasukan" ? "masuk" : "keluar");
  }

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setGalat(!(angka > 0) ? "Nominal belum diisi" : !deskripsi.trim() ? "Deskripsi belum diisi" : "Pilih kategori dulu");
      return;
    }
    setSibuk(true);
    setGalat("");
    try {
      await onSimpan({ nominal: angka, deskripsi: deskripsi.trim(), jenis, arah, kategoriId, tanggal });
      onTutup();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menyimpan");
      setSibuk(false);
    }
  }

  async function hapus() {
    if (!onHapus || !window.confirm(`Hapus "${transaksi!.deskripsi}" ${rupiah(transaksi!.nominal)}?`)) return;
    setSibuk(true);
    try {
      await onHapus();
      onTutup();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menghapus");
      setSibuk(false);
    }
  }

  return (
    <LembarBawah judul={edit ? "Edit transaksi" : "Catat manual"} onTutup={onTutup}>
      <form className="form-transaksi" onSubmit={simpan} noValidate>
        <div className="form-kepala">
          <span className="form-judul">{edit ? "Edit transaksi" : "Catat manual"}</span>
          <button type="button" className="tombol-bulat" aria-label="Tutup" onClick={onTutup}>
            <Ikon nama="tutup" ukuran={18} tebal={2.2} />
          </button>
        </div>

        <div className="isian-nominal">
          <span className="isian-nominal-rp">Rp</span>
          <label className="sr-only" htmlFor="nominal">Nominal</label>
          <input
            id="nominal"
            className="num"
            inputMode="numeric"
            autoComplete="off"
            autoFocus={!edit}
            placeholder="0"
            value={nominal}
            onChange={(e) => {
              const digit = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13);
              setNominal(digit ? ribuan(Number(digit)) : "");
            }}
          />
        </div>

        <label className="sr-only" htmlFor="deskripsi">Deskripsi</label>
        <input
          id="deskripsi"
          className="isian"
          placeholder="Deskripsi"
          maxLength={100}
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
        />

        <PilihJenis nilai={jenis} onPilih={gantiJenis} />

        {jenis === "investasi" && (
          <div className="segmen dua" role="group" aria-label="Arah uang investasi">
            <button type="button" aria-pressed={arah === "keluar"} onClick={() => setArah("keluar")}>Setor / beli</button>
            <button type="button" aria-pressed={arah === "masuk"} onClick={() => setArah("masuk")}>Tarik / jual</button>
          </div>
        )}

        {jenis !== "usaha" && (
          <>
            <GridKategori key={jenis} kategori={kategori} jenis={jenis} terpilih={kategoriId} onPilih={(k) => setKategoriId(k.id)} />
            {edit && (
              <span className="form-sumber">
                {kategoriBerubah
                  ? `Diubah, ${deskripsi.trim() || transaksi!.deskripsi} akan diingat sebagai kategori ini`
                  : transaksi!.perluTanya ? "Belum ada kategori" : KETERANGAN_SUMBER[transaksi!.sumber]}
              </span>
            )}
          </>
        )}

        <div className="tanggal-wadah">
          <button
            type="button"
            className="tombol-garis kiri"
            onClick={() => {
              const el = inputTanggal.current;
              if (el?.showPicker) el.showPicker();
              else el?.focus();
            }}
          >
            <Ikon nama="kalender" ukuran={16} />
            {labelTanggal(tanggal, hariIni)}
          </button>
          <label className="sr-only" htmlFor="tanggal">Tanggal</label>
          <input
            ref={inputTanggal}
            id="tanggal"
            type="date"
            className="tanggal-asli"
            max={hariIni}
            value={tanggal}
            onChange={(e) => e.target.value && setTanggal(e.target.value)}
          />
        </div>

        {galat && <p className="galat" role="alert">{galat}</p>}

        <div className={edit ? "form-aksi dua" : "form-aksi"}>
          {edit && onHapus && (
            <button type="button" className="tombol-hapus" disabled={sibuk} onClick={hapus}>Hapus</button>
          )}
          <button type="submit" className="tombol-utama besar" disabled={sibuk}>Simpan</button>
        </div>
      </form>
    </LembarBawah>
  );
}

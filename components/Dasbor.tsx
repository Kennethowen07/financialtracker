"use client";
// Dashboard utama: kotak input + ringkasan + daftar transaksi + panel tanya balik/edit.
// Dipakai mode pribadi (data dari API) dan mode demo (data di browser) lewat `gudang`.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { InfoAkun } from "@/lib/akun";
import { denganSesi, gudangServer, type Gudang } from "@/lib/gudang";
import type { Kategori } from "@/lib/kategori";
import { ringkas } from "@/lib/laporan";
import { bacaInput, type AlasanGagalBaca } from "@/lib/parser";
import { bulanSebelumnya } from "@/lib/tanggal";
import { labelTanggal } from "@/lib/format";
import { usePengenalSuara, type GagalSuara } from "@/lib/suara";
import type { HasilItem, PilihanKategori, Transaksi, TransaksiManual } from "@/lib/transaksi";
import { DaftarPerHari, GrafikMinggu, KartuRingkasan, PemilihBulan, PerKategori, TabelTransaksi, type ItemSementara } from "./Bagian";
import { FormTransaksi, PanelTanya } from "./Lembar";
import { Ikon } from "./Ikon";
import { KartuSuara, TombolMikrofon, type KeadaanKartu } from "./InputSuara";
import { LembarMutasi, MenuInput } from "./UploadMutasi";
import { Kerangka } from "./Kerangka";

export interface DataAwal {
  kategori: Kategori[];
  transaksi: Transaksi[];
  transaksiLalu: Transaksi[];
}

interface Props {
  hariIni: string;
  awal?: DataAwal;
  gudang?: Gudang;
  /** Isi tambahan di samping pemilih bulan (mis. label kuota demo). */
  kepala?: ReactNode;
  /** Tombol contoh yang mengisi kotak input saat belum ada transaksi (mode demo). */
  contoh?: string[];
  /** Dipanggil setelah teks (ketik/suara) berhasil dicatat. Mode demo memakai ini untuk panduan. */
  setelahCatat?: (cara: "ketik" | "suara") => void;
  /** Isi tambahan di paling atas dashboard (mis. kartu panduan demo). */
  atas?: ReactNode;
  /** Akun yang login (kosong di mode demo). */
  akun?: InfoAkun;
}

const PESAN_GAGAL: Record<AlasanGagalBaca, string> = {
  kosong: "Ketik dulu transaksinya, misalnya makan 25000",
  tanpa_nominal: "Nominalnya belum ada. Contoh: makan 25000",
  tanggal_masa_depan: "Tanggal masa depan tidak bisa dicatat",
  tanggal_tidak_valid: "Tanggalnya tidak valid",
};

/** Pesan saat input suara gagal. izin_layanan: pelajaran dari tes di iPhone (docs/PROGRESSAI.md). */
const PESAN_SUARA: Record<GagalSuara, string> = {
  tidak_terdengar: "Suara nggak tertangkap, coba lagi atau ketik",
  izin_mikrofon: "Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser",
  izin_layanan: "Nyalakan Speech Recognition untuk Safari di Settings → Privacy & Security, lalu buka ulang",
  jaringan: "Pengenal suara butuh internet, coba lagi atau ketik",
  lain: "Suara nggak tertangkap, coba lagi atau ketik",
};

const urutkan = (a: Transaksi, b: Transaksi) => b.tanggal.localeCompare(a.tanggal) || b.id - a.id;

interface Pesan {
  teks: string;
  aksi?: { label: string; jalankan: () => void };
}

export function Dasbor({ hariIni, awal, gudang: gudangAsli = gudangServer, kepala, contoh, setelahCatat, atas, akun }: Props) {
  const router = useRouter();
  const gudang = useMemo(() => denganSesi(gudangAsli, () => router.push("/masuk")), [gudangAsli, router]);
  const bulanIni = hariIni.slice(0, 7);
  const [bulan, setBulan] = useState(bulanIni);
  const [kategori, setKategori] = useState<Kategori[]>(awal?.kategori ?? []);
  const [daftar, setDaftar] = useState<Transaksi[]>(awal?.transaksi ?? []);
  const [daftarLalu, setDaftarLalu] = useState<Transaksi[]>(awal?.transaksiLalu ?? []);
  const [memuat, setMemuat] = useState(!awal);
  const [sementara, setSementara] = useState<ItemSementara[]>([]);
  const [antrian, setAntrian] = useState<{ transaksi: Transaksi; tanyaJenis: boolean }[]>([]);
  const [edit, setEdit] = useState<Transaksi | "baru" | null>(null);
  const [kartu, setKartu] = useState<KeadaanKartu | null>(null);
  const [menu, setMenu] = useState(false);
  const [berkasMutasi, setBerkasMutasi] = useState<File[] | null>(null);
  const [teks, setTeks] = useState("");
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const nomor = useRef(0);

  /** Ambil kategori + transaksi bulan b dan bulan sebelumnya, lalu isi state (di callback, setelah data datang). */
  const ambil = useCallback((b: string) => {
    return Promise.all([gudang.kategori(), gudang.transaksiBulan(b), gudang.transaksiBulan(bulanSebelumnya(b))])
      .then(([kat, ini, lalu]) => {
        setKategori(kat);
        setDaftar(ini.sort(urutkan));
        setDaftarLalu(lalu);
      })
      .catch((e: unknown) => setPesan({ teks: e instanceof Error ? e.message : "Gagal memuat data" }))
      .finally(() => setMemuat(false));
  }, [gudang]);

  // Tanpa data awal (mode demo), muat dari gudang saat pertama dibuka.
  // `memuat` sudah bernilai true sejak awal, jadi state baru diisi setelah data datang.
  useEffect(() => {
    if (!awal) void ambil(bulanIni);
  }, [awal, ambil, bulanIni]);

  // Pesan hilang sendiri setelah beberapa detik.
  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), pesan.aksi ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [pesan]);

  const r = useMemo(() => ringkas(bulan, daftar, daftarLalu, hariIni), [bulan, daftar, daftarLalu, hariIni]);

  function gantiBulan(b: string) {
    setBulan(b);
    setMemuat(true);
    void ambil(b);
  }

  /** Masukkan/ganti transaksi di daftar sesuai bulan yang sedang dilihat. */
  function terapkan(t: Transaksi) {
    setDaftar((lama) => {
      const tanpa = lama.filter((x) => x.id !== t.id);
      return t.tanggal.startsWith(bulan) ? [...tanpa, t].sort(urutkan) : tanpa;
    });
  }

  async function kirim(e?: FormEvent) {
    e?.preventDefault();
    const isi = teks.trim();
    const baca = bacaInput(isi);
    if (!baca.ok) {
      setPesan({ teks: PESAN_GAGAL[baca.alasan] });
      return;
    }
    setTeks("");
    input.current?.focus();
    await catat(isi, "ketik");
  }

  /**
   * Simpan teks (ketikan atau hasil suara). Transaksi langsung tampil dengan status memproses.
   * Yang belum dikenal memori langsung ditanyakan kategorinya, termasuk hasil suara setelah
   * hitung mundur habis (permintaan pemilik, docs/KEPUTUSAN.md no. 35).
   */
  async function catat(isi: string, cara: "ketik" | "suara") {
    const baca = bacaInput(isi);
    if (!baca.ok) return;

    // Langsung tampil dengan status memproses (PRD: transaksi tampil begitu dikirim).
    const kunci = baca.items.map(() => `s${++nomor.current}`);
    if (baca.tanggal.startsWith(bulan)) {
      setSementara((s) => [
        ...baca.items.map((it, i) => ({ kunci: kunci[i], deskripsi: it.deskripsi, nominal: it.nominal, tanggal: baca.tanggal })),
        ...s,
      ]);
    }

    try {
      const hasil = await gudang.catat(isi, cara);
      if (!hasil.ok) {
        setPesan({ teks: PESAN_GAGAL[hasil.alasan] });
        setTeks(isi);
        return;
      }
      for (const h of hasil.hasil) terapkan(h.transaksi);
      const tanya = hasil.hasil.filter((h) => h.tanya).map((h) => ({ transaksi: h.transaksi, tanyaJenis: h.tanya!.tanyaJenis }));
      if (tanya.length) setAntrian((a) => [...a, ...tanya]);

      const pertama = hasil.hasil[0].transaksi;
      if (!pertama.tanggal.startsWith(bulan)) {
        setPesan({ teks: `Tercatat untuk ${labelTanggal(pertama.tanggal, hariIni)}` });
      } else if (hasil.tanggalDariTeks && !tanya.length) {
        setPesan({ teks: `Dicatat untuk ${labelTanggal(pertama.tanggal, hariIni)}`, aksi: { label: "Ubah", jalankan: () => setEdit(pertama) } });
      }
      setelahCatat?.(cara);
    } catch (err) {
      setTeks(isi);
      setPesan({ teks: err instanceof Error ? err.message : "Gagal menyimpan, coba lagi" });
    } finally {
      setSementara((s) => s.filter((x) => !kunci.includes(x.kunci)));
    }
  }

  // ---------- input suara ----------

  const suara = usePengenalSuara({
    onSelesai: (t) => void bacaSuara(t),
    onGagal: (alasan) => {
      setKartu(null);
      setPesan({ teks: PESAN_SUARA[alasan] });
    },
  });

  /** Hasil suara → pratinjau. Kalau nominal tidak terbaca, coba minta Gemini menulis ulang (berkuota). */
  async function bacaSuara(teksSuara: string) {
    setKartu({ tahap: "membaca", teks: teksSuara });
    try {
      let isi = teksSuara;
      let p = await gudang.pratinjau(isi);
      if (!p.ok && p.alasan === "tanpa_nominal") {
        const r = await gudang.rapikanSuara(isi);
        if (r.ok) {
          isi = r.teks;
          p = await gudang.pratinjau(isi);
        }
      }
      if (!p.ok) {
        keKotakInput(teksSuara, p.alasan === "tanpa_nominal" ? "Nominal nggak kebaca, cek lagi ya" : PESAN_GAGAL[p.alasan]);
        return;
      }
      setKartu({ tahap: "siap", teks: isi, items: p.items });
    } catch (err) {
      keKotakInput(teksSuara, err instanceof Error ? err.message : "Gagal membaca, coba lagi");
    }
  }

  function keKotakInput(isi: string, pesanTeks?: string) {
    setKartu(null);
    setTeks(isi);
    if (pesanTeks) setPesan({ teks: pesanTeks });
    input.current?.focus();
  }

  function simpanSuara() {
    if (kartu?.tahap !== "siap") return;
    setKartu(null);
    void catat(kartu.teks, "suara");
  }

  // Selama ditahan, kartu menampilkan teks sementara yang sedang terdengar.
  const kartuTampil: KeadaanKartu | null =
    suara.status === "merekam" ? { tahap: "merekam", sementara: suara.sementara } : kartu;

  // ---------- screenshot mutasi (hanya mode pribadi) ----------

  const bisaMutasi = Boolean(gudang.bacaMutasi);

  // Kategori sudah bisa dipilih di layar periksa, jadi yang dibiarkan kosong tidak ditanyakan satu per
  // satu; cukup penanda "belum dikategorikan" (permintaan pemilik, KEPUTUSAN 51).
  function selesaiMutasi(hasil: HasilItem[]) {
    setBerkasMutasi(null);
    for (const h of hasil) terapkan(h.transaksi);
    const belum = hasil.filter((h) => h.transaksi.perluTanya).length;
    setPesan({ teks: `${hasil.length} transaksi tersimpan${belum ? `, ${belum} belum dikategorikan` : ""}` });
  }

  function pilihTransaksi(t: Transaksi) {
    if (t.perluTanya) setAntrian((a) => [{ transaksi: t, tanyaJenis: true }, ...a.filter((x) => x.transaksi.id !== t.id)]);
    else setEdit(t);
  }

  async function jawab(pilihan: PilihanKategori) {
    const t = antrian[0].transaksi;
    const baru = await gudang.jawab(t.id, pilihan);
    // Panel ditutup oleh PanelTanya sendiri setelah pesan "Tersimpan" sempat terbaca.
    setDaftar((lama) => lama.map((x) => (x.id === baru.id ? baru : x)));
    if (pilihan.kategoriBaru) setKategori(await gudang.kategori());
  }

  const tutupTanya = useCallback(() => {
    setAntrian((a) => a.slice(1));
    input.current?.focus(); // langsung siap mengetik transaksi berikutnya
  }, []);
  const tutupEdit = useCallback(() => {
    setEdit(null);
    input.current?.focus();
  }, []);

  async function simpanForm(data: TransaksiManual) {
    const t = edit && edit !== "baru"
      ? await gudang.edit(edit.id, data)
      : await gudang.tambahManual(data);
    terapkan(t);
    if (!t.tanggal.startsWith(bulan)) setPesan({ teks: `Tersimpan untuk ${labelTanggal(t.tanggal, hariIni)}` });
  }

  async function hapus() {
    if (!edit || edit === "baru") return;
    await gudang.hapus(edit.id);
    setDaftar((lama) => lama.filter((x) => x.id !== edit.id));
  }

  const tanyaSekarang = antrian[0];
  const belumDikategorikan = daftar.filter((t) => t.perluTanya);
  const kosong = !memuat && daftar.length === 0 && sementara.length === 0;
  const demo = gudang.mode === "demo";

  return (
    <Kerangka aktif="dasbor" akun={demo ? undefined : akun}>
      <header className="atas">
        <div className="atas-kiri">
          <PemilihBulan bulan={bulan} bulanIni={bulanIni} onPilih={gantiBulan} />
          {kepala}
        </div>
        {!demo && (
          <div className="atas-tombol">
            <Link href="/analisis" className="tombol-bintang" aria-label="Analisis AI">
              <Ikon nama="bintang" ukuran={20} />
            </Link>
            {/* Di HP sidebar disembunyikan, jadi akun & tombol keluar dibuka dari sini. */}
            <Link href="/akun" className="tombol-bintang tombol-akun" aria-label="Akun">
              <Ikon nama="pengguna" ukuran={20} />
            </Link>
          </div>
        )}

        <form className="kotak-input" onSubmit={kirim}>
          {kartuTampil && (
            <KartuSuara
              keadaan={kartuTampil}
              onSimpan={simpanSuara}
              onBatal={() => {
                setKartu(null);
                input.current?.focus();
              }}
              onEdit={() => {
                if (kartu?.tahap === "siap") keKotakInput(kartu.teks);
              }}
            />
          )}
          <button
            type="button"
            className="tombol-bulat input-menu"
            aria-label="Tambah transaksi: upload mutasi atau form manual"
            onClick={() => setMenu(true)}
          >
            <Ikon nama="menu" ukuran={20} />
          </button>
          <label className="sr-only" htmlFor="catat">Catat transaksi</label>
          <input
            ref={input}
            id="catat"
            className="input-catat"
            type="text"
            placeholder="makan 25000"
            autoComplete="off"
            autoFocus
            enterKeyHint="send"
            maxLength={500}
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
          />
          {/* Seperti WhatsApp: selama kotak kosong, tombol kirim diganti mikrofon. */}
          {suara.dukung && !teks.trim() ? (
            <TombolMikrofon
              status={suara.status}
              onMulai={() => {
                setKartu(null);
                suara.mulai();
              }}
              onLepas={suara.lepas}
            />
          ) : (
            <button type="submit" className="tombol-kirim" aria-label="Kirim">
              <Ikon nama="kirim" ukuran={20} tebal={2.2} />
            </button>
          )}
        </form>
      </header>

      <main className={memuat ? "dasbor memuat" : "dasbor"} aria-busy={memuat}>
        {atas}
        <KartuRingkasan r={r} />
        <div className="dua-kolom">
          <GrafikMinggu r={r} />
          <PerKategori r={r} />
        </div>

        {kosong && contoh && (
          <section className="kartu contoh">
            <h2 className="kartu-judul">Coba ketik</h2>
            <div className="contoh-tombol">
              {contoh.map((c) => (
                <button key={c} type="button" onClick={() => { setTeks(c); input.current?.focus(); }}>
                  {c}
                </button>
              ))}
            </div>
            <span className="contoh-catatan">Data cuma tersimpan di browser ini.</span>
          </section>
        )}
        {kosong && !contoh && <p className="kosong-besar">Belum ada transaksi di bulan ini. Ketik di kotak input, misalnya <b>makan 25000</b>.</p>}

        {belumDikategorikan.length > 0 && (
          <button
            type="button"
            className="penanda-belum"
            onClick={() => setAntrian(belumDikategorikan.map((t) => ({ transaksi: t, tanyaJenis: true })))}
          >
            <span className="titik-kuning" aria-hidden="true" />
            {belumDikategorikan.length} belum dikategorikan
          </button>
        )}

        <div className="hanya-hp">
          <DaftarPerHari transaksi={daftar} sementara={sementara} hariIni={hariIni} onPilih={pilihTransaksi} />
        </div>
        <div className="hanya-laptop">
          <TabelTransaksi transaksi={daftar} sementara={sementara} hariIni={hariIni} onPilih={pilihTransaksi} />
        </div>
      </main>

      {pesan && (
        <div className="pesan" role="status">
          <span>{pesan.teks}</span>
          {pesan.aksi && (
            <button type="button" onClick={() => { pesan.aksi!.jalankan(); setPesan(null); }}>
              {pesan.aksi.label}
            </button>
          )}
        </div>
      )}

      {tanyaSekarang && (
        <PanelTanya
          key={tanyaSekarang.transaksi.id}
          transaksi={tanyaSekarang.transaksi}
          tanyaJenis={tanyaSekarang.tanyaJenis}
          kategori={kategori}
          onJawab={jawab}
          onTutup={tutupTanya}
        />
      )}
      {!tanyaSekarang && !edit && menu && (
        <MenuInput
          perluLogin={!bisaMutasi}
          onMutasi={(berkas) => {
            setMenu(false);
            setBerkasMutasi(berkas);
          }}
          onManual={() => {
            setMenu(false);
            setEdit("baru");
          }}
          onTutup={() => setMenu(false)}
        />
      )}
      {!tanyaSekarang && !edit && berkasMutasi && (
        <LembarMutasi
          berkas={berkasMutasi}
          gudang={gudang}
          kategori={kategori}
          onSelesai={selesaiMutasi}
          onTutup={() => setBerkasMutasi(null)}
        />
      )}
      {!tanyaSekarang && edit && (
        <FormTransaksi
          key={edit === "baru" ? "baru" : edit.id}
          transaksi={edit === "baru" ? undefined : edit}
          kategori={kategori}
          hariIni={hariIni}
          onSimpan={simpanForm}
          onHapus={edit === "baru" ? undefined : hapus}
          onTutup={tutupEdit}
        />
      )}
    </Kerangka>
  );
}

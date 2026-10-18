"use client";
// Tur panduan di /demo (gaya coach mark): layar digelapkan, tombol yang dibahas disorot dengan
// bingkai putus-putus, dan balon keterangan menunjuk ke tombol itu ("1/3", Lanjut, tutup).
// Langkah: (1) tombol mikrofon, (2) kotak input, (3) tombol garis tiga (upload mutasi, butuh login).
// Tombol yang disorot tetap bisa dipakai, jadi pengunjung bisa langsung mencoba; percobaan yang
// berhasil ditandai otomatis. Muncul sampai selesai/ditutup di browser itu, bisa dibuka lagi.
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ikon } from "./Ikon";

const KUNCI = "panduan-demo-v1";

// localStorage dibaca lewat useSyncExternalStore supaya render server (tur tersembunyi) dan
// browser tidak bentrok saat hidrasi.
const pendengar = new Set<() => void>();
const toko = {
  langganan(f: () => void) {
    pendengar.add(f);
    return () => {
      pendengar.delete(f);
    };
  },
  selesai(): boolean {
    try {
      return localStorage.getItem(KUNCI) === "selesai";
    } catch {
      return false;
    }
  },
  tandaiSelesai() {
    try {
      localStorage.setItem(KUNCI, "selesai");
    } catch {
      // mode privat: tur tetap bisa ditutup selama halaman terbuka
    }
    pendengar.forEach((f) => f());
  },
};
const tanpaLangganan = () => () => {};
const adaPengenalSuara = () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window;

interface Langkah {
  /** Elemen yang disorot. */
  target: string;
  judul: string;
  isi: ReactNode;
}

function daftarLangkah(suara: boolean): Langkah[] {
  return [
    suara
      ? {
          target: ".tombol-mik",
          judul: "Catat pakai suara",
          isi: (
            <>
              <p>
                <b>Tahan</b> tombol ini, ucapkan <b>&quot;kopi lima belas ribu&quot;</b>, lalu <b>lepas</b>. Transaksi
                tersimpan setelah hitung mundur 3 detik.
              </p>
              <p className="tur-kecil">
                iPhone: kalau muncul pesan izin, buka Settings → Privacy &amp; Security → Speech Recognition, nyalakan Safari.
              </p>
            </>
          ),
        }
      : {
          target: ".tombol-kirim",
          judul: "Catat pakai suara",
          isi: <p>Browser ini belum mendukung pengenal suara. Coba buka demo ini di Chrome atau Safari untuk mencobanya.</p>,
        },
    {
      target: "#catat",
      judul: "Catat dengan mengetik",
      isi: (
        <p>
          Ketik <b>rasela 25000</b> lalu kirim. Pilih kategorinya sekali, berikutnya &quot;rasela&quot; langsung dikenali.
        </p>
      ),
    },
    {
      target: ".input-menu",
      judul: "Catat dari screenshot mutasi",
      isi: (
        <>
          <p>
            Di akun pribadi, tombol ini juga bisa <b>upload screenshot mutasi</b> BCA, blu, GoPay, Grab, atau ShopeePay. Semua
            transaksinya terbaca sekaligus.
          </p>
          <p className="tur-kecil">
            Butuh login Google (hanya nama dan email, tanpa akses Gmail atau Drive). Data tiap akun terpisah, koneksi
            terenkripsi, dan gambar tidak disimpan. Screenshot dibaca oleh Google Gemini, lihat{" "}
            <Link href="/privasi">kebijakan privasi</Link>.
          </p>
          <Link href="/masuk" className="tur-google">
            Masuk dengan Google
          </Link>
        </>
      ),
    },
  ];
}

/** Posisi elemen target, diukur ulang saat layar diubah/digulir. */
function useKotak(selector: string | null): DOMRect | null {
  const [kotak, setKotak] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!selector) return;
    let bingkai = 0;
    const ukur = () => {
      cancelAnimationFrame(bingkai);
      bingkai = requestAnimationFrame(() => setKotak(document.querySelector(selector)?.getBoundingClientRect() ?? null));
    };
    ukur();
    // Tombol mikrofon baru muncul setelah browser dicek, jadi ukur ulang sebentar-sebentar.
    const jaga = setInterval(ukur, 500);
    window.addEventListener("resize", ukur);
    window.addEventListener("scroll", ukur, true);
    return () => {
      cancelAnimationFrame(bingkai);
      clearInterval(jaga);
      window.removeEventListener("resize", ukur);
      window.removeEventListener("scroll", ukur, true);
    };
  }, [selector]);
  return kotak;
}

interface Props {
  /** Cara input terakhir yang berhasil dicatat (dari Dasbor), untuk menandai langkah berhasil. */
  terakhir: { cara: "ketik" | "suara"; ke: number } | null;
}

const LEBAR_BALON = 300;
const JARAK = 14;

export function PanduanDemo({ terakhir }: Props) {
  const selesai = useSyncExternalStore(toko.langganan, toko.selesai, () => true);
  const suara = useSyncExternalStore(tanpaLangganan, adaPengenalSuara, () => true);
  const [langkah, setLangkah] = useState(0);
  const [dibuka, setDibuka] = useState(false);
  const [berhasil, setBerhasil] = useState<Set<number>>(() => new Set());

  // Input yang berhasil dicatat → tandai langkahnya berhasil (suara = langkah 1, ketik = langkah 2).
  const [diproses, setDiproses] = useState(0);
  if (terakhir && terakhir.ke !== diproses) {
    setDiproses(terakhir.ke);
    const lk = terakhir.cara === "suara" ? 0 : 1;
    if (!berhasil.has(lk)) setBerhasil(new Set(berhasil).add(lk));
  }

  const tampil = dibuka || !selesai;
  const langkahIni = daftarLangkah(suara)[langkah];
  const kotak = useKotak(tampil ? langkahIni.target : null);

  function tutup() {
    toko.tandaiSelesai();
    setDibuka(false);
  }

  if (!tampil) {
    return (
      <button
        type="button"
        className="panduan-buka"
        onClick={() => {
          setLangkah(0);
          setDibuka(true);
        }}
      >
        <Ikon nama="tanya" ukuran={14} />
        Panduan
      </button>
    );
  }
  if (!kotak) return null;

  // Balon di bawah target kalau muat, kalau tidak di atasnya (di HP kotak input ada di bawah layar).
  const lebarLayar = window.innerWidth;
  const tinggiLayar = window.innerHeight;
  const lebar = Math.min(LEBAR_BALON, lebarLayar - 24);
  const kiri = Math.min(Math.max(kotak.left + kotak.width / 2 - lebar / 2, 12), lebarLayar - lebar - 12);
  const diBawah = kotak.bottom + JARAK + 260 < tinggiLayar;
  const panah = Math.min(Math.max(kotak.left + kotak.width / 2 - kiri, 20), lebar - 20);
  const sudah = berhasil.has(langkah);
  const terakhirKah = langkah === 2;

  return createPortal(
    <div className="tur" role="dialog" aria-label={`Panduan ${langkah + 1} dari 3: ${langkahIni.judul}`}>
      <div
        className="tur-sorot"
        style={{ left: kotak.left - 6, top: kotak.top - 6, width: kotak.width + 12, height: kotak.height + 12 }}
        aria-hidden="true"
      />
      <div
        className={diBawah ? "tur-balon bawah" : "tur-balon atas"}
        style={{
          left: kiri,
          width: lebar,
          ...(diBawah ? { top: kotak.bottom + JARAK } : { bottom: tinggiLayar - kotak.top + JARAK }),
        }}
      >
        <span className="tur-panah" style={{ left: panah }} aria-hidden="true" />
        <button type="button" className="tur-tutup" aria-label="Tutup panduan" onClick={tutup}>
          <Ikon nama="tutup" ukuran={14} tebal={2.4} />
        </button>
        <strong className="tur-judul">{langkahIni.judul}</strong>
        <div className="tur-isi">{langkahIni.isi}</div>
        {sudah && <p className="tur-berhasil" role="status">Berhasil!</p>}
        <div className="tur-kaki">
          <span className="tur-nomor">
            <b>{langkah + 1}</b>/3
          </span>
          <span className="tur-tombol">
            {langkah > 0 && (
              <button type="button" className="tur-kembali" onClick={() => setLangkah(langkah - 1)}>
                Kembali
              </button>
            )}
            <button type="button" className="tur-lanjut" onClick={() => (terakhirKah ? tutup() : setLangkah(langkah + 1))}>
              {terakhirKah ? "OK" : "Lanjut"}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

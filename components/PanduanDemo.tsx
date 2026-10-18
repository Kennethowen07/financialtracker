"use client";
// Panduan langkah demi langkah di /demo: (1) coba input suara, (2) coba input ketik, (3) upload
// screenshot mutasi (butuh akun Google). Muncul otomatis sampai selesai/dilewati di browser itu,
// dan bisa dibuka lagi lewat tombol "Panduan". Langkah 1 dan 2 ditandai berhasil otomatis.
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Ikon } from "./Ikon";

const KUNCI = "panduan-demo-v1";
type Simpanan = "selesai" | null;

// localStorage dibaca lewat useSyncExternalStore supaya render server (panduan tersembunyi)
// dan browser tidak bentrok saat hidrasi.
const pendengar = new Set<() => void>();
const toko = {
  langganan(f: () => void) {
    pendengar.add(f);
    return () => {
      pendengar.delete(f);
    };
  },
  ambil(): Simpanan {
    try {
      return localStorage.getItem(KUNCI) === "selesai" ? "selesai" : null;
    } catch {
      return null;
    }
  },
  ganti(nilai: Simpanan) {
    try {
      if (nilai) localStorage.setItem(KUNCI, nilai);
      else localStorage.removeItem(KUNCI);
    } catch {
      // mode privat: panduan tetap jalan selama halaman terbuka
    }
    pendengar.forEach((f) => f());
  },
};
const tanpaLangganan = () => () => {};
const adaPengenalSuara = () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window;

/** Tombol yang sedang dibahas diberi cahaya berdenyut (lihat CSS [data-panduan]). */
export type SorotPanduan = "mik" | "input" | null;

interface Props {
  /** Cara input terakhir yang berhasil dicatat (dari Dasbor), untuk menandai langkah berhasil. */
  terakhir: { cara: "ketik" | "suara"; ke: number } | null;
}

export function PanduanDemo({ terakhir }: Props) {
  const simpanan = useSyncExternalStore(toko.langganan, toko.ambil, () => "selesai" as Simpanan);
  const suara = useSyncExternalStore(tanpaLangganan, adaPengenalSuara, () => true);
  const [langkah, setLangkah] = useState(0);
  const [dibuka, setDibuka] = useState(false);
  // Langkah yang sudah berhasil dicoba (dihitung dari input yang tercatat).
  const [berhasil, setBerhasil] = useState<Set<number>>(() => new Set());

  const tampil = dibuka || simpanan !== "selesai";

  // Input yang berhasil dicatat → tandai langkahnya berhasil.
  const [diproses, setDiproses] = useState(0);
  if (terakhir && terakhir.ke !== diproses) {
    setDiproses(terakhir.ke);
    const lk = terakhir.cara === "suara" ? 0 : 1;
    if (!berhasil.has(lk)) setBerhasil(new Set(berhasil).add(lk));
  }

  // Sorot tombol yang sedang dibahas.
  const sorot: SorotPanduan = !tampil ? null : langkah === 0 && suara ? "mik" : langkah === 1 ? "input" : null;
  useEffect(() => {
    if (sorot) document.body.dataset.panduan = sorot;
    else delete document.body.dataset.panduan;
    return () => {
      delete document.body.dataset.panduan;
    };
  }, [sorot]);

  function tutup() {
    toko.ganti("selesai");
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

  const sudah = berhasil.has(langkah);

  return (
    <section className="kartu panduan" aria-label="Panduan mencoba demo">
      <div className="panduan-kepala">
        <span className="panduan-langkah">Panduan · {langkah + 1}/3</span>
        <button type="button" className="panduan-lewati" onClick={tutup}>
          Lewati
        </button>
      </div>

      {langkah === 0 && (
        <>
          <h2 className="panduan-judul">Catat pakai suara</h2>
          {suara ? (
            <ol className="panduan-daftar">
              <li>
                <b>Tahan</b> tombol mikrofon <Ikon nama="mikrofon" ukuran={14} /> di kanan kotak input (yang berdenyut).
              </li>
              <li>
                Sambil menahan, ucapkan: <b>&quot;kopi lima belas ribu&quot;</b>.
              </li>
              <li>
                <b>Lepas</b> tombolnya. Muncul kartu hasil dengan hitung mundur 3 detik, lalu transaksinya tersimpan.
              </li>
            </ol>
          ) : (
            <p className="panduan-teks">
              Browser ini belum mendukung pengenal suara. Coba buka demo ini di Chrome atau Safari, atau lanjut ke langkah
              berikutnya.
            </p>
          )}
          {suara && (
            <p className="panduan-tips">
              iPhone: kalau muncul pesan izin, buka Settings → Privacy &amp; Security → Speech Recognition, lalu nyalakan
              Safari.
            </p>
          )}
        </>
      )}

      {langkah === 1 && (
        <>
          <h2 className="panduan-judul">Catat dengan mengetik</h2>
          <ol className="panduan-daftar">
            <li>
              Ketik <b>rasela 25000</b> di kotak input, lalu kirim.
            </li>
            <li>&quot;rasela&quot; belum dikenal, jadi kamu ditanya kategorinya sekali. Pilih satu.</li>
            <li>
              Ketik <b>rasela 30000</b>. Sekarang langsung dikenali tanpa ditanya.
            </li>
          </ol>
          <p className="panduan-tips">
            Mau isi lengkap (tanggal, jenis, kategori)? Tekan tombol garis tiga <Ikon nama="menu" ukuran={14} /> di kiri
            kotak input.
          </p>
        </>
      )}

      {langkah === 2 && (
        <>
          <h2 className="panduan-judul">Catat dari screenshot mutasi</h2>
          <p className="panduan-teks">
            Upload screenshot riwayat transaksi BCA, blu, GoPay, Grab, atau ShopeePay, lalu semua transaksinya terbaca
            sekaligus. Fitur ini butuh akun, karena hasilnya disimpan sebagai catatan pribadimu.
          </p>
          <ul className="panduan-catatan">
            <li>Login Google hanya mengambil nama dan email. Aplikasi tidak bisa membuka Gmail, Drive, atau kontakmu.</li>
            <li>Data tiap akun terpisah dan tidak terlihat oleh akun lain.</li>
            <li>Koneksi terenkripsi (HTTPS). Gambar screenshot tidak disimpan di server.</li>
            <li>
              Screenshot dibaca oleh Google Gemini. Selengkapnya di <Link href="/privasi">kebijakan privasi</Link>.
            </li>
          </ul>
          <Link href="/masuk" className="tombol-google panduan-google">
            Masuk dengan Google
          </Link>
        </>
      )}

      {sudah && <p className="panduan-berhasil" role="status">Berhasil! Lanjut ke langkah berikutnya.</p>}

      <div className="panduan-tombol">
        {langkah > 0 && (
          <button type="button" className="tombol-kedua" onClick={() => setLangkah(langkah - 1)}>
            Kembali
          </button>
        )}
        {langkah < 2 ? (
          <button type="button" className={sudah ? "tombol-utama" : "tombol-kedua"} onClick={() => setLangkah(langkah + 1)}>
            {sudah ? "Lanjut" : "Lewati langkah ini"}
          </button>
        ) : (
          <button type="button" className="tombol-kedua" onClick={tutup}>
            Selesai
          </button>
        )}
      </div>
    </section>
  );
}

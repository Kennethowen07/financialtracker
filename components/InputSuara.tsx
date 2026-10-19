"use client";
// Input suara: tombol mikrofon yang ditahan, dan kartu hasil
// dengan hitung mundur 3 detik sebelum tersimpan (Batalkan / Edit, seperti batal pesanan di Gojek).
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { rupiah } from "@/lib/format";
import type { StatusSuara } from "@/lib/suara";
import type { ItemPratinjau } from "@/lib/transaksi";
import { Ikon } from "./Ikon";

export const HITUNG_MUNDUR_MS = 3000;

interface PropsTombol {
  status: StatusSuara;
  onMulai: () => void;
  onLepas: () => void;
}

/** Tahan untuk bicara, lepas untuk selesai. Juga bisa dengan tombol Spasi/Enter ditahan. */
export function TombolMikrofon({ status, onMulai, onLepas }: PropsTombol) {
  function tekan(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault(); // jangan pindahkan fokus / pilih teks saat ditahan
    e.currentTarget.setPointerCapture(e.pointerId);
    onMulai();
  }
  function tombolKeyboard(e: KeyboardEvent<HTMLButtonElement>, turun: boolean) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (turun && !e.repeat) onMulai();
    if (!turun) onLepas();
  }

  return (
    <button
      type="button"
      className={status === "merekam" ? "tombol-kirim tombol-mik merekam" : "tombol-kirim tombol-mik"}
      aria-label="Tahan untuk bicara"
      aria-pressed={status === "merekam"}
      onPointerDown={tekan}
      onPointerUp={onLepas}
      onPointerCancel={onLepas}
      onKeyDown={(e) => tombolKeyboard(e, true)}
      onKeyUp={(e) => tombolKeyboard(e, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Ikon nama="mikrofon" ukuran={21} tebal={2.2} />
    </button>
  );
}

export type KeadaanKartu =
  | { tahap: "merekam"; sementara: string }
  | { tahap: "membaca"; teks: string }
  | { tahap: "siap"; teks: string; items: ItemPratinjau[] };

interface PropsKartu {
  keadaan: KeadaanKartu;
  onSimpan: () => void;
  onBatal: () => void;
  onEdit: () => void;
}

export function KartuSuara({ keadaan, onSimpan, onBatal, onEdit }: PropsKartu) {
  if (keadaan.tahap === "merekam") {
    return (
      <div className="kartu-suara" role="status">
        <p className="suara-sementara">
          <span className="titik-rekam" aria-hidden="true" />
          {keadaan.sementara || "Mendengarkan…"}
        </p>
        <span className="suara-petunjuk">Lepas untuk selesai</span>
      </div>
    );
  }
  if (keadaan.tahap === "membaca") {
    return (
      <div className="kartu-suara" role="status" aria-busy="true">
        <p className="suara-terdengar">Terdengar: “{keadaan.teks}”</p>
        <span className="suara-petunjuk">Membaca…</span>
      </div>
    );
  }
  return <KartuSiap teks={keadaan.teks} items={keadaan.items} onSimpan={onSimpan} onBatal={onBatal} onEdit={onEdit} />;
}

function KartuSiap({ teks, items, onSimpan, onBatal, onEdit }: { teks: string; items: ItemPratinjau[] } & Omit<PropsKartu, "keadaan">) {
  // Menyentuh kartu menghentikan hitung mundur, supaya tidak tersimpan saat sedang dibaca.
  const [jeda, setJeda] = useState(false);
  const [sisa, setSisa] = useState(HITUNG_MUNDUR_MS);
  const simpan = useRef(onSimpan);
  useEffect(() => {
    simpan.current = onSimpan;
  });

  useEffect(() => {
    if (jeda) return;
    const mulai = Date.now();
    const t = setInterval(() => {
      const s = Math.max(0, HITUNG_MUNDUR_MS - (Date.now() - mulai));
      setSisa(s);
      if (s === 0) {
        clearInterval(t);
        simpan.current();
      }
    }, 100);
    return () => clearInterval(t);
  }, [jeda]);

  return (
    <div className="kartu-suara" role="dialog" aria-label="Hasil suara" onPointerDown={() => setJeda(true)}>
      <p className="suara-terdengar">Terdengar: “{teks}”</p>
      <ul className="suara-item">
        {items.map((it, i) => (
          <li key={i}>
            <span className={it.perluTanya ? "trx-ikon tanya" : "trx-ikon"}>
              <Ikon nama={it.perluTanya ? "tanya" : (it.kategori?.ikon ?? (it.jenis === "usaha" ? "usaha" : "lainnya"))} ukuran={16} />
            </span>
            <span className="suara-deskripsi">
              {it.deskripsi}
              {it.perluTanya && <span className="suara-belum">belum ada kategori</span>}
            </span>
            <span className="num">{rupiah(it.nominal)}</span>
          </li>
        ))}
      </ul>
      {!jeda && (
        <div className="suara-progres" aria-hidden="true">
          <span style={{ width: `${(sisa / HITUNG_MUNDUR_MS) * 100}%` }} />
        </div>
      )}
      <div className="suara-tombol">
        <button type="button" className="tombol-kedua" onClick={onBatal}>Batalkan</button>
        <button type="button" className={jeda ? "tombol-kedua" : "tombol-utama"} onClick={onEdit}>Edit</button>
        {jeda && <button type="button" className="tombol-utama" onClick={onSimpan}>Simpan</button>}
      </div>
      <span className="suara-petunjuk" aria-live="polite">
        {jeda ? "Hitung mundur dihentikan" : `Tersimpan dalam ${Math.ceil(sisa / 1000)}`}
      </span>
    </div>
  );
}

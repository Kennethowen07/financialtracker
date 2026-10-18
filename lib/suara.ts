"use client";
// Pengenal suara bawaan browser (Web Speech API, docs/PRD.md "Input suara").
// Pola yang sudah dites di iPhone (halaman tes sementara, docs/PROGRESSAI.md): objek pengenal baru setiap rekaman,
// continuous mati, bahasa id-ID, dan dianggap macet kalau 4 detik setelah tombol dilepas
// belum ada hasil (Safari iPhone kadang terlihat mendengarkan padahal tidak mengembalikan apa-apa).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export const BATAS_MACET_MS = 4000;

// Tipe minimal, karena webkitSpeechRecognition tidak ada di lib.dom TypeScript.
interface EventHasil {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface PengenalSuara {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: EventHasil) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type KelasPengenal = new () => PengenalSuara;

function ambilPengenal(): KelasPengenal | null {
  const w = window as unknown as { SpeechRecognition?: KelasPengenal; webkitSpeechRecognition?: KelasPengenal };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Kenapa rekaman gagal. "izin_layanan" = iOS menolak sebelum minta izin mikrofon. */
export type GagalSuara = "tidak_terdengar" | "izin_mikrofon" | "izin_layanan" | "jaringan" | "lain";

function keGagal(kode: string): GagalSuara {
  if (kode === "not-allowed") return "izin_mikrofon";
  if (kode === "service-not-allowed") return "izin_layanan";
  if (kode === "network") return "jaringan";
  if (kode === "no-speech" || kode === "aborted" || kode === "audio-capture") return "tidak_terdengar";
  return "lain";
}

export type StatusSuara = "diam" | "merekam" | "menunggu";

interface Opsi {
  onSelesai: (teks: string) => void;
  onGagal: (alasan: GagalSuara) => void;
}

const tanpaLangganan = () => () => {};

export function usePengenalSuara({ onSelesai, onGagal }: Opsi) {
  // null saat render server, supaya tombol mikrofon baru muncul setelah browser dicek.
  const dukung = useSyncExternalStore(tanpaLangganan, () => ambilPengenal() !== null, () => null);
  const [status, setStatus] = useState<StatusSuara>("diam");
  const [sementara, setSementara] = useState("");

  const pengenal = useRef<PengenalSuara | null>(null);
  const sesi = useRef({ teks: "", ditahan: false, selesai: true, error: "" });
  const pewaktu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const balasan = useRef({ onSelesai, onGagal });
  useEffect(() => {
    balasan.current = { onSelesai, onGagal };
  });

  useEffect(() => () => pengenal.current?.abort(), []);

  const akhiri = useCallback((hasil: { teks: string } | { gagal: GagalSuara }) => {
    const s = sesi.current;
    if (s.selesai) return;
    s.selesai = true;
    if (pewaktu.current) clearTimeout(pewaktu.current);
    setStatus("diam");
    setSementara("");
    if ("teks" in hasil) balasan.current.onSelesai(hasil.teks);
    else balasan.current.onGagal(hasil.gagal);
  }, []);

  /** Tombol mulai ditahan. */
  const mulai = useCallback(() => {
    const Kelas = ambilPengenal();
    if (!Kelas || !sesi.current.selesai) return;
    const rec = new Kelas();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.continuous = false;
    sesi.current = { teks: "", ditahan: true, selesai: false, error: "" };

    rec.onresult = (ev) => {
      let akhir = "";
      let antara = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) akhir += r[0].transcript;
        else antara += r[0].transcript;
      }
      sesi.current.teks = akhir || antara;
      setSementara(akhir + antara);
    };
    rec.onerror = (ev) => {
      sesi.current.error = ev.error;
      // no-speech/aborted diputuskan saat selesai (bisa jadi masih ada teks).
      if (ev.error !== "no-speech" && ev.error !== "aborted") akhiri({ gagal: keGagal(ev.error) });
    };
    rec.onend = () => {
      const s = sesi.current;
      if (s.selesai) return;
      if (s.teks.trim()) akhiri({ teks: s.teks.trim() });
      else if (!s.ditahan) akhiri({ gagal: keGagal(s.error || "no-speech") });
      // Masih ditahan tapi pengenal berhenti sendiri: tunggu tombol dilepas.
    };

    pengenal.current = rec;
    setStatus("merekam");
    setSementara("");
    try {
      rec.start();
    } catch {
      akhiri({ gagal: "lain" });
    }
  }, [akhiri]);

  /** Tombol dilepas: berhenti merekam, tunggu hasil akhir paling lama 4 detik. */
  const lepas = useCallback(() => {
    const s = sesi.current;
    if (!s.ditahan || s.selesai) return;
    s.ditahan = false;
    setStatus("menunggu");
    pengenal.current?.stop();
    pewaktu.current = setTimeout(() => {
      if (sesi.current.selesai) return;
      const teks = sesi.current.teks.trim();
      if (!teks) pengenal.current?.abort();
      akhiri(teks ? { teks } : { gagal: "tidak_terdengar" });
    }, BATAS_MACET_MS);
  }, [akhiri]);

  return { dukung, status, sementara, mulai, lepas };
}

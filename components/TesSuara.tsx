"use client";
// Halaman /tes-suara: tahan untuk bicara, lalu catat apa yang dikembalikan browser dan hasil parser-nya.
// Tujuannya mengecek pengenal suara bawaan (Web Speech API, id-ID) di iPhone, Safari dan PWA,
// sebelum fitur aslinya dibangun. Setiap rekaman memakai objek pengenal baru (PRD).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bacaInput } from "@/lib/parser";

const KALIMAT_TES = [
  "rasela dua puluh lima ribu",
  "parkir goceng",
  "kopi lima belas ribu roti dua puluh ribu",
  "gaji enam juta",
  "grab tiga puluh tiga ribu",
];
const BATAS_MACET_MS = 4000;
const KUNCI_RIWAYAT = "tes-suara-riwayat";

// Tipe minimal, karena webkitSpeechRecognition tidak ada di lib.dom TypeScript.
interface HasilSuara {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventHasil {
  resultIndex: number;
  results: ArrayLike<HasilSuara>;
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

type Status = "selesai" | "macet" | "error" | "berhenti_sendiri";

interface Percobaan {
  no: number;
  waktu: string;
  mode: string;
  target: string | null;
  mentah: string;
  status: Status;
  error?: string;
  /** Jeda dari tombol dilepas sampai hasil akhir masuk. */
  jedaMs: number | null;
  parser: string;
}

function ambilPengenal(): KelasPengenal | null {
  const w = window as unknown as { SpeechRecognition?: KelasPengenal; webkitSpeechRecognition?: KelasPengenal };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function deteksiMode(): string {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone ? "PWA" : "Browser";
}

function ringkasParser(teks: string): string {
  if (!teks.trim()) return "-";
  const hasil = bacaInput(teks);
  if (!hasil.ok) return `gagal: ${hasil.alasan}`;
  const items = hasil.items.map((i) => `"${i.deskripsi}" Rp${i.nominal.toLocaleString("id-ID")}`).join(", ");
  return `${hasil.items.length} item: ${items} (tanggal ${hasil.tanggal})`;
}

function bacaRiwayat(): Percobaan[] {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_RIWAYAT) ?? "[]") as Percobaan[];
  } catch {
    return [];
  }
}

function simpanRiwayat(riwayat: Percobaan[]) {
  try {
    localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(riwayat));
  } catch {
    // Mode privat atau penyimpanan penuh: riwayat tetap ada di layar.
  }
}

// Riwayat disimpan di localStorage dan dibaca lewat useSyncExternalStore, supaya render server
// (riwayat kosong) dan browser tidak bentrok saat hidrasi.
const RIWAYAT_KOSONG: Percobaan[] = [];
let cacheRiwayat: Percobaan[] | null = null;
const pendengar = new Set<() => void>();
const tokoRiwayat = {
  langganan(f: () => void) {
    pendengar.add(f);
    return () => {
      pendengar.delete(f);
    };
  },
  ambil: () => (cacheRiwayat ??= bacaRiwayat()),
  ambilServer: () => RIWAYAT_KOSONG,
  ganti(baru: Percobaan[]) {
    cacheRiwayat = baru;
    simpanRiwayat(baru);
    pendengar.forEach((f) => f());
  },
};

// Nilai lingkungan browser yang tidak berubah selama halaman terbuka.
const tanpaLangganan = () => () => {};

function keTeks(riwayat: Percobaan[], info: string): string {
  const baris = riwayat
    .slice()
    .reverse()
    .map((p) =>
      [
        `#${p.no} ${p.waktu} [${p.mode}] ${p.status}${p.error ? ` (${p.error})` : ""}${p.jedaMs !== null ? `, ${p.jedaMs} ms` : ""}`,
        `  target : ${p.target ?? "-"}`,
        `  mentah : ${p.mentah || "(kosong)"}`,
        `  parser : ${p.parser}`,
      ].join("\n"),
    );
  return [info, "", ...baris].join("\n");
}

export function TesSuara() {
  const dukung = useSyncExternalStore(tanpaLangganan, () => ambilPengenal() !== null, () => null);
  const mode = useSyncExternalStore(tanpaLangganan, deteksiMode, () => "");
  const infoBrowser = useSyncExternalStore(tanpaLangganan, () => navigator.userAgent, () => "");
  const riwayat = useSyncExternalStore(tokoRiwayat.langganan, tokoRiwayat.ambil, tokoRiwayat.ambilServer);
  const [target, setTarget] = useState<string | null>(KALIMAT_TES[0]);
  const [merekam, setMerekam] = useState(false);
  const [menunggu, setMenunggu] = useState(false);
  const [sementara, setSementara] = useState("");
  const [disalin, setDisalin] = useState(false);

  const pengenal = useRef<PengenalSuara | null>(null);
  const sesi = useRef({ teks: "", ditahan: false, selesai: true, dilepasPada: 0, error: "" });
  const pewaktu = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => pengenal.current?.abort(), []);

  function catat(status: Status) {
    const s = sesi.current;
    if (s.selesai) return;
    s.selesai = true;
    if (pewaktu.current) clearTimeout(pewaktu.current);
    setMerekam(false);
    setMenunggu(false);
    setSementara("");
    const teks = s.teks.trim();
    const lama = tokoRiwayat.ambil();
    const baru: Percobaan = {
      no: (lama[0]?.no ?? 0) + 1,
      waktu: new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }),
      mode: deteksiMode(),
      target,
      mentah: teks,
      status,
      error: s.error || undefined,
      jedaMs: s.dilepasPada && status === "selesai" ? Date.now() - s.dilepasPada : null,
      parser: ringkasParser(teks),
    };
    tokoRiwayat.ganti([baru, ...lama]);
  }

  function mulai(e: React.PointerEvent<HTMLButtonElement>) {
    const Kelas = ambilPengenal();
    if (!Kelas || !sesi.current.selesai) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const rec = new Kelas();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.continuous = true;
    sesi.current = { teks: "", ditahan: true, selesai: false, dilepasPada: 0, error: "" };

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
      if (ev.error !== "no-speech" && ev.error !== "aborted") catat("error");
    };
    rec.onend = () => {
      const s = sesi.current;
      if (s.selesai) return;
      if (s.teks.trim()) catat("selesai");
      else if (s.ditahan) catat("berhenti_sendiri");
      else if (s.error) catat("error");
      // Kalau tidak ada teks dan tombol sudah dilepas, biarkan pewaktu macet yang memutuskan.
    };

    pengenal.current = rec;
    setMerekam(true);
    setSementara("");
    try {
      rec.start();
    } catch (err) {
      sesi.current.error = err instanceof Error ? err.message : String(err);
      catat("error");
    }
  }

  function lepas() {
    const s = sesi.current;
    if (!s.ditahan) return;
    s.ditahan = false;
    if (s.selesai) return;
    s.dilepasPada = Date.now();
    setMerekam(false);
    setMenunggu(true);
    pengenal.current?.stop();
    pewaktu.current = setTimeout(() => {
      if (sesi.current.selesai) return;
      if (sesi.current.teks.trim()) {
        catat("selesai");
      } else {
        pengenal.current?.abort();
        catat("macet");
      }
    }, BATAS_MACET_MS);
  }

  async function salin() {
    const teks = keTeks(riwayat, `${mode} | ${infoBrowser}`);
    try {
      await navigator.clipboard.writeText(teks);
      setDisalin(true);
      setTimeout(() => setDisalin(false), 2000);
    } catch {
      window.prompt("Salin manual:", teks);
    }
  }

  function hapus() {
    if (!window.confirm("Hapus semua riwayat tes?")) return;
    tokoRiwayat.ganti([]);
  }

  const terakhir = riwayat[0];

  return (
    <main className="tes-suara">
      <h1>Tes suara</h1>
      <p className="tes-sub">Halaman sementara. Tidak menyimpan ke database dan tidak memanggil AI.</p>

      <div className="tes-info">
        <span>
          Pengenal suara:{" "}
          {dukung === null ? "memeriksa…" : dukung ? <b className="tes-ok">didukung</b> : <b className="tes-gagal">tidak didukung</b>}
        </span>
        <span>Mode: {mode || "…"}</span>
      </div>

      <section>
        <h2>Kalimat tes</h2>
        <p className="tes-sub">Tap kalimat yang mau kamu ucapkan, supaya tercatat di riwayat.</p>
        <div className="tes-daftar">
          {KALIMAT_TES.map((k) => (
            <button key={k} type="button" className={k === target ? "tes-kalimat aktif" : "tes-kalimat"} onClick={() => setTarget(k)}>
              {k}
            </button>
          ))}
          <button type="button" className={target === null ? "tes-kalimat aktif" : "tes-kalimat"} onClick={() => setTarget(null)}>
            (bebas)
          </button>
        </div>
      </section>

      <section className="tes-rekam">
        <p className="tes-sementara" aria-live="polite">
          {merekam ? sementara || "Mendengarkan…" : menunggu ? sementara || "Menunggu hasil…" : terakhir ? `Terakhir: ${terakhir.mentah || "(kosong)"}` : "Tahan tombol, bicara, lalu lepas."}
        </p>
        <button
          type="button"
          className={merekam ? "tes-mik merekam" : "tes-mik"}
          disabled={!dukung || menunggu}
          onPointerDown={mulai}
          onPointerUp={lepas}
          onPointerCancel={lepas}
          onContextMenu={(e) => e.preventDefault()}
        >
          {merekam ? "Lepas untuk selesai" : menunggu ? "Menunggu…" : "Tahan untuk bicara"}
        </button>
        {terakhir?.status === "macet" && <p className="tes-gagal">Suara nggak tertangkap, coba lagi atau ketik.</p>}
      </section>

      <section>
        <div className="tes-kepala-riwayat">
          <h2>Riwayat ({riwayat.length})</h2>
          <div className="tes-aksi">
            <button type="button" className="tes-kecil" onClick={salin} disabled={riwayat.length === 0}>
              {disalin ? "Tersalin" : "Salin semua"}
            </button>
            <button type="button" className="tes-kecil" onClick={hapus} disabled={riwayat.length === 0}>
              Hapus
            </button>
          </div>
        </div>
        {riwayat.length === 0 ? (
          <p className="tes-sub">Belum ada percobaan.</p>
        ) : (
          <ol className="tes-riwayat">
            {riwayat.map((p) => (
              <li key={p.no} className="tes-entri">
                <div className="tes-entri-kepala">
                  <span>
                    #{p.no} · {p.waktu} · {p.mode}
                  </span>
                  <span className={p.status === "selesai" ? "tes-ok" : "tes-gagal"}>
                    {p.status}
                    {p.error ? ` (${p.error})` : ""}
                    {p.jedaMs !== null ? ` · ${p.jedaMs} ms` : ""}
                  </span>
                </div>
                <dl>
                  <dt>Target</dt>
                  <dd>{p.target ?? "-"}</dd>
                  <dt>Mentah</dt>
                  <dd>{p.mentah || "(kosong)"}</dd>
                  <dt>Parser</dt>
                  <dd>{p.parser}</dd>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

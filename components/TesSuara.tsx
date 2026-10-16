"use client";
// Halaman /tes-suara: tahan untuk bicara, lalu catat apa yang dikembalikan browser dan hasil parser-nya.
// Tujuannya mengecek pengenal suara bawaan (Web Speech API, id-ID) di iPhone, Safari dan PWA,
// sebelum fitur aslinya dibangun. Setiap rekaman memakai objek pengenal baru (PRD).
// Pilihan bahasa, cara mulai, dan continuous ada untuk memisahkan penyebab error (mis. service-not-allowed di iOS).
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
const PILIHAN_BAHASA = [
  { nilai: "id-ID", label: "id-ID" },
  { nilai: "en-US", label: "en-US" },
  { nilai: "", label: "Bawaan HP" },
];
type Cara = "tahan" | "tap";
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
  onerror: ((e: { error: string; message?: string }) => void) | null;
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
  /** Penjelasan error dari browser, kalau ada. */
  pesan?: string;
  /** Kosong berarti bahasa bawaan HP. Tidak ada di riwayat lama. */
  bahasa?: string;
  cara?: Cara;
  /** Riwayat lama (sebelum pilihan ini ada) selalu continuous. */
  kontinu?: boolean;
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
        `#${p.no} ${p.waktu} [${p.mode}, ${p.cara ?? "tahan"}, ${p.bahasa === undefined ? "id-ID" : p.bahasa || "bawaan"}, continuous ${p.kontinu === false ? "mati" : "nyala"}] ${p.status}${p.error ? ` (${p.error})` : ""}${p.jedaMs !== null ? `, ${p.jedaMs} ms` : ""}`,
        ...(p.pesan ? [`  pesan  : ${p.pesan}`] : []),
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
  const [bahasa, setBahasa] = useState("id-ID");
  const [cara, setCara] = useState<Cara>("tahan");
  // Default mati: ada laporan service-not-allowed di iOS hanya saat continuous nyala.
  const [kontinu, setKontinu] = useState(false);

  const pengenal = useRef<PengenalSuara | null>(null);
  const sesi = useRef({ teks: "", aktif: false, selesai: true, dilepasPada: 0, error: "", pesan: "" });
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
      pesan: s.pesan || undefined,
      bahasa,
      cara,
      kontinu,
      jedaMs: s.dilepasPada && status === "selesai" ? Date.now() - s.dilepasPada : null,
      parser: ringkasParser(teks),
    };
    tokoRiwayat.ganti([baru, ...lama]);
  }

  function mulai() {
    const Kelas = ambilPengenal();
    if (!Kelas || !sesi.current.selesai) return;

    const rec = new Kelas();
    if (bahasa) rec.lang = bahasa;
    rec.interimResults = true;
    rec.continuous = kontinu;
    sesi.current = { teks: "", aktif: true, selesai: false, dilepasPada: 0, error: "", pesan: "" };

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
      sesi.current.pesan = ev.message ?? "";
      if (ev.error !== "no-speech" && ev.error !== "aborted") catat("error");
    };
    rec.onend = () => {
      const s = sesi.current;
      if (s.selesai) return;
      if (s.teks.trim()) catat("selesai");
      else if (s.aktif) catat("berhenti_sendiri");
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

  /** Pengguna selesai bicara: tombol dilepas (mode tahan) atau ditap lagi (mode tap). */
  function lepas() {
    const s = sesi.current;
    if (!s.aktif) return;
    s.aktif = false;
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

      <section>
        <h2>Pengaturan</h2>
        <p className="tes-sub">Untuk mencari penyebab error. Tiap percobaan mencatat pilihan yang dipakai.</p>
        <div className="tes-daftar">
          <span className="tes-label">Bahasa</span>
          {PILIHAN_BAHASA.map((b) => (
            <button key={b.label} type="button" className={b.nilai === bahasa ? "tes-kalimat aktif" : "tes-kalimat"} disabled={merekam || menunggu} onClick={() => setBahasa(b.nilai)}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="tes-daftar">
          <span className="tes-label">Cara mulai</span>
          {(["tahan", "tap"] as const).map((c) => (
            <button key={c} type="button" className={c === cara ? "tes-kalimat aktif" : "tes-kalimat"} disabled={merekam || menunggu} onClick={() => setCara(c)}>
              {c === "tahan" ? "Tahan" : "Tap mulai, tap selesai"}
            </button>
          ))}
        </div>
        <div className="tes-daftar">
          <span className="tes-label">Continuous</span>
          {[false, true].map((k) => (
            <button key={String(k)} type="button" className={k === kontinu ? "tes-kalimat aktif" : "tes-kalimat"} disabled={merekam || menunggu} onClick={() => setKontinu(k)}>
              {k ? "Nyala" : "Mati"}
            </button>
          ))}
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
          {...(cara === "tahan"
            ? {
                onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  mulai();
                },
                onPointerUp: lepas,
                onPointerCancel: lepas,
              }
            : { onClick: () => (sesi.current.aktif ? lepas() : mulai()) })}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menunggu
            ? "Menunggu…"
            : cara === "tahan"
              ? merekam
                ? "Lepas untuk selesai"
                : "Tahan untuk bicara"
              : merekam
                ? "Tap untuk selesai"
                : "Tap untuk mulai"}
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
                    #{p.no} · {p.waktu} · {p.mode} · {p.cara ?? "tahan"} · {p.bahasa === undefined ? "id-ID" : p.bahasa || "bawaan"} · continuous{" "}
                    {p.kontinu === false ? "mati" : "nyala"}
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
                  {p.pesan && (
                    <>
                      <dt>Pesan</dt>
                      <dd>{p.pesan}</dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

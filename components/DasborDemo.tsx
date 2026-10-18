"use client";
// Mode demo (docs/design/06): dashboard yang sama, data di browser, label kuota AI.
import { useEffect, useMemo, useState } from "react";
import { buatGudangDemo } from "@/lib/demo";
import { Dasbor } from "./Dasbor";
import { PanduanDemo } from "./PanduanDemo";

export function DasborDemo({ hariIni, aiAktif }: { hariIni: string; aiAktif: boolean }) {
  const [sisa, setSisa] = useState<number | null>(null);
  const [terakhir, setTerakhir] = useState<{ cara: "ketik" | "suara"; ke: number } | null>(null);
  const gudang = useMemo(() => buatGudangDemo({ hariIni: () => hariIni, padaKuota: setSisa }), [hariIni]);

  useEffect(() => {
    fetch("/api/demo/kuota")
      .then((r) => r.json())
      .then((k: { sisa: number }) => setSisa(k.sisa))
      .catch(() => setSisa(0));
  }, []);

  const habis = sisa !== null && sisa <= 0;
  const label = !aiAktif ? "Demo, AI off" : sisa === null ? "Demo" : habis ? "Demo, AI habis" : `Demo, ${sisa} AI tersisa`;

  return (
    <Dasbor
      hariIni={hariIni}
      gudang={gudang}
      contoh={["makan 25000", "rasela 25000", "gaji 5000000"]}
      atas={<PanduanDemo terakhir={terakhir} />}
      setelahCatat={(cara) => setTerakhir((t) => ({ cara, ke: (t?.ke ?? 0) + 1 }))}
      kepala={
        <span className={habis || !aiAktif ? "pil-demo habis" : "pil-demo"} role="status">
          <span className="pil-titik" aria-hidden="true" />
          {label}
        </span>
      }
    />
  );
}

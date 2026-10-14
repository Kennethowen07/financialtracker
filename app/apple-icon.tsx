import { gambarIkon } from "@/lib/gambar-ikon";

// Ikon layar utama iPhone (iOS tidak memakai ikon dari manifest).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return gambarIkon(180, true);
}

// Script di folder scripts/ dijalankan di luar Next.js, jadi file .env tidak
// dimuat otomatis. Fungsi ini meniru urutan Next.js: .env.local dulu, lalu .env.
// Nilai yang sudah ada di environment tidak ditimpa.
export function muatEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // file tidak ada, lewati
    }
  }
}

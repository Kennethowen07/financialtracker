import { fileURLToPath } from "node:url";

// Membaca konfigurasi dari file .env (fitur bawaan Node 22, tanpa library dotenv).
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // .env belum dibuat — nilai di bawah tetap bisa diisi lewat environment variable.
}

const list = (value) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// `--demo`: pakai database contoh terpisah dan jangan jalankan bot.
const demo = process.argv.includes("--demo");

export const config = {
  demo,
  telegramToken: demo ? "" : (process.env.TELEGRAM_BOT_TOKEN ?? ""),
  allowedUserIds: list(process.env.ALLOWED_USER_IDS),
  anthropicEnabled: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
  timezone: process.env.TIMEZONE || "Asia/Jakarta",
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  dashboardUrl: process.env.DASHBOARD_URL || "",
  dashboardPassword: process.env.DASHBOARD_PASSWORD || "",
  dbPath: demo
    ? fileURLToPath(new URL("../data/demo.db", import.meta.url))
    : process.env.DB_PATH || fileURLToPath(new URL("../data/finance.db", import.meta.url)),
};

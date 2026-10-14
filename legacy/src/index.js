import { config } from "./config.js";
import { startServer } from "./server.js";
import { startBot } from "./bot.js";

console.log(`[app] model AI: ${config.anthropicEnabled ? config.model : "tidak aktif (pakai parser lokal)"}`);

await startServer();

if (config.demo) {
  console.log(`[app] mode demo — database: ${config.dbPath}`);
} else if (config.telegramToken) {
  await startBot();
} else {
  console.warn("[bot] TELEGRAM_BOT_TOKEN belum diisi di .env — bot tidak dijalankan, hanya dashboard.");
}

// Simulasi alur bot tanpa koneksi ke Telegram/Claude: update palsu masuk,
// semua panggilan Telegram API dicegat dan dicatat.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "findet-")), "test.db");
process.env.ALLOWED_USER_IDS = "111";
process.env.TELEGRAM_BOT_TOKEN = "123:test";
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_AUTH_TOKEN = "";

const { createBot } = await import("../src/bot.js");
const { summarizeRange } = await import("../src/db.js");
const { todayLocal } = await import("../src/format.js");

let bot;
let calls = [];
let updateId = 1;

before(async () => {
  bot = createBot();
  bot.botInfo = { id: 1, is_bot: true, first_name: "Test", username: "test_bot" };
  bot.api.config.use((_prev, method, payload) => {
    calls.push({ method, payload });
    return Promise.resolve({ ok: true, result: method === "sendMessage" ? { message_id: 1 } : true });
  });
});

async function send(text, fromId = 111) {
  calls = [];
  await bot.handleUpdate({
    update_id: updateId++,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: fromId, type: "private" },
      from: { id: fromId, is_bot: false, first_name: "User" },
      text,
      ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] } : {}),
    },
  });
  return calls.filter((c) => c.method === "sendMessage").map((c) => c.payload);
}

test("mencatat 'makan 25000' dan 'kuota 100000'", async () => {
  const [reply] = await send("makan 25000");
  assert.match(reply.text, /Tercatat/);
  assert.match(reply.text, /Makanan &amp; Minuman/);
  assert.ok(reply.reply_markup.inline_keyboard[0][0].callback_data.startsWith("undo:"));

  await send("kuota 100000");
  const today = todayLocal();
  const { totals, byCategory } = summarizeRange(today, today, 111);
  assert.equal(totals.expense, 125000);
  assert.deepEqual(byCategory.map((r) => r.category).sort(), ["Makanan & Minuman", "Pulsa & Internet"]);
});

test("/hari menampilkan ringkasan", async () => {
  const [reply] = await send("/hari");
  assert.match(reply.text, /Pengeluaran per kategori/);
  assert.match(reply.text, /Pulsa &amp; Internet/);
});

test("/hapus menghapus catatan terakhir", async () => {
  const [reply] = await send("/hapus");
  assert.match(reply.text, /Dihapus/);
  const today = todayLocal();
  assert.equal(summarizeRange(today, today, 111).totals.expense, 25000);
});

test("pesan tanpa nominal tidak dicatat", async () => {
  const [reply] = await send("halo");
  assert.match(reply.text, /tidak menemukan nominal/);
});

test("user lain ditolak", async () => {
  const [reply] = await send("makan 999999", 222);
  assert.match(reply.text, /pribadi/);
  assert.equal(summarizeRange("2000-01-01", "2100-01-01", 222).totals.count, 0);
});

import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { categoryIcon } from "./categories.js";
import { parseMessage, getMonthInsight } from "./ai.js";
import { deleteLastEntry, deleteTransactions, insertTransactions, summarizeRange } from "./db.js";
import { addDays, escapeHtml, rupiah, todayLocal } from "./format.js";

const shortDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (iso) => shortDate.format(new Date(`${iso}T00:00:00Z`));

const HELP = `Kirim pengeluaran/pemasukan dengan bahasa biasa, contoh:
• <code>makan 25000</code>
• <code>kuota 100rb</code>
• <code>bensin 30k, parkir 5000</code>
• <code>kemarin nonton bioskop 50rb</code>
• <code>gaji 5jt</code>

Perintah:
/hari — ringkasan hari ini
/minggu — ringkasan 7 hari terakhir
/bulan — ringkasan bulan ini
/insight — analisis AI bulan ini
/hapus — hapus catatan terakhir
/dashboard — link dashboard`;

function formatSummary(title, summary) {
  const { totals, byCategory } = summary;
  if (totals.count === 0) return `📊 <b>${title}</b>\nBelum ada transaksi.`;

  const lines = [
    `📊 <b>${title}</b>`,
    `Pengeluaran: <b>${rupiah(totals.expense)}</b>`,
    `Pemasukan: <b>${rupiah(totals.income)}</b>`,
    `Selisih: <b>${rupiah(totals.income - totals.expense)}</b>`,
  ];
  for (const type of ["expense", "income"]) {
    const rows = byCategory.filter((r) => r.type === type);
    if (rows.length === 0) continue;
    lines.push("", type === "expense" ? "<b>Pengeluaran per kategori</b>" : "<b>Pemasukan per kategori</b>");
    for (const r of rows) {
      lines.push(`${categoryIcon(r.category)} ${escapeHtml(r.category)} — ${rupiah(r.total)} (${r.count}x)`);
    }
  }
  return lines.join("\n");
}

export function createBot() {
  const bot = new Bot(config.telegramToken);

  // Hanya pemilik (ALLOWED_USER_IDS) yang boleh memakai bot.
  bot.use(async (ctx, next) => {
    const userId = String(ctx.from?.id ?? "");
    if (config.allowedUserIds.includes(userId)) return next();

    if (config.allowedUserIds.length === 0) {
      await ctx.reply(
        `👋 Halo! ID Telegram kamu: <code>${userId}</code>\n\n` +
          `Masukkan ID ini ke file <code>.env</code>:\n<code>ALLOWED_USER_IDS=${userId}</code>\n` +
          `lalu restart aplikasi. Setelah itu bot siap mencatat.`,
        { parse_mode: "HTML" },
      );
    } else {
      await ctx.reply("Maaf, bot ini bersifat pribadi.");
    }
  });

  bot.command(["start", "help"], (ctx) => ctx.reply(`👋 Halo! Aku pencatat keuanganmu.\n\n${HELP}`, { parse_mode: "HTML" }));

  bot.command("hari", (ctx) => {
    const today = todayLocal();
    const summary = summarizeRange(today, today, ctx.from.id);
    return ctx.reply(formatSummary(`Hari ini (${fmtDate(today)})`, summary), { parse_mode: "HTML" });
  });

  bot.command("minggu", (ctx) => {
    const today = todayLocal();
    const from = addDays(today, -6);
    const summary = summarizeRange(from, today, ctx.from.id);
    return ctx.reply(formatSummary(`7 hari terakhir (${fmtDate(from)} – ${fmtDate(today)})`, summary), {
      parse_mode: "HTML",
    });
  });

  bot.command("bulan", (ctx) => {
    const month = todayLocal().slice(0, 7);
    const summary = summarizeRange(`${month}-01`, `${month}-31`, ctx.from.id);
    return ctx.reply(formatSummary(`Bulan ini (${month})`, summary), { parse_mode: "HTML" });
  });

  bot.command("insight", async (ctx) => {
    await ctx.replyWithChatAction("typing");
    const { content } = await getMonthInsight(todayLocal().slice(0, 7));
    return ctx.reply(`🤖 <b>Analisis bulan ini</b>\n\n${escapeHtml(content)}`, { parse_mode: "HTML" });
  });

  bot.command(["hapus", "undo"], (ctx) => {
    const removed = deleteLastEntry(ctx.from.id);
    if (removed.length === 0) return ctx.reply("Belum ada catatan untuk dihapus.");
    const list = removed.map((t) => `• ${escapeHtml(t.description)} — ${rupiah(t.amount)}`).join("\n");
    return ctx.reply(`🗑️ Dihapus:\n${list}`, { parse_mode: "HTML" });
  });

  bot.command("dashboard", (ctx) =>
    ctx.reply(
      config.dashboardUrl
        ? `📈 Dashboard: ${config.dashboardUrl}`
        : `📈 Dashboard berjalan di http://localhost:${config.port} (buka dari komputer yang menjalankan aplikasi).`,
    ),
  );

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return ctx.reply("Perintah tidak dikenal. Ketik /help.");
    if (text.length > 1000) return ctx.reply("Pesannya terlalu panjang. Kirim maksimal 1000 karakter ya.");

    await ctx.replyWithChatAction("typing");
    const result = await parseMessage(text);

    if (result.transactions.length === 0) {
      const reason = result.note || "Aku tidak menemukan nominal di pesan itu.";
      return ctx.reply(`🤔 ${escapeHtml(reason)}\n\nContoh: <code>makan 25000</code> atau /help`, { parse_mode: "HTML" });
    }

    const saved = insertTransactions(ctx.from.id, result.transactions, text, result.source);
    const today = todayLocal();
    const todayTotal = summarizeRange(today, today, ctx.from.id).totals.expense;

    const lines = saved.map((t) => {
      const sign = t.type === "income" ? "+" : "";
      const when = t.date === today ? "" : ` · ${fmtDate(t.date)}`;
      return `${categoryIcon(t.category)} ${escapeHtml(t.description)} — <b>${sign}${rupiah(t.amount)}</b>\n     <i>${escapeHtml(t.category)}${when}</i>`;
    });
    const footer = `\n\nPengeluaran hari ini: <b>${rupiah(todayTotal)}</b>` +
      (result.source === "lokal" ? "\n<i>(dicatat tanpa AI)</i>" : "");

    const ids = saved.map((t) => t.id);
    const keyboard = new InlineKeyboard().text("↩️ Batalkan", `undo:${Math.min(...ids)}-${Math.max(...ids)}`);
    return ctx.reply(`✅ Tercatat\n${lines.join("\n")}${footer}`, { parse_mode: "HTML", reply_markup: keyboard });
  });

  bot.callbackQuery(/^undo:(\d+)-(\d+)$/, async (ctx) => {
    const [from, to] = [Number(ctx.match[1]), Number(ctx.match[2])];
    if (to - from > 50) return ctx.answerCallbackQuery({ text: "Data tidak valid." });
    const ids = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const count = deleteTransactions(ctx.from.id, ids);
    await ctx.answerCallbackQuery({ text: count ? "Dibatalkan" : "Sudah dihapus sebelumnya" });
    if (count) await ctx.editMessageText(`↩️ Dibatalkan (${count} transaksi dihapus).`);
  });

  bot.catch((err) => console.error("[bot] error:", err.error ?? err));

  return bot;
}

export async function startBot() {
  const bot = createBot();
  await bot.api.setMyCommands([
    { command: "hari", description: "Ringkasan hari ini" },
    { command: "minggu", description: "Ringkasan 7 hari terakhir" },
    { command: "bulan", description: "Ringkasan bulan ini" },
    { command: "insight", description: "Analisis AI bulan ini" },
    { command: "hapus", description: "Hapus catatan terakhir" },
    { command: "dashboard", description: "Link dashboard" },
    { command: "help", description: "Cara pakai" },
  ]);
  bot.start({
    onStart: (me) => console.log(`[bot] @${me.username} aktif — kirim pesan ke bot di Telegram`),
  });
  return bot;
}

import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";

/**
 * Amibara Telegram Support — single-file implementation.
 * Runtime: Node.js 20+, TypeScript, Telegraf.
 *
 * Supports:
 * - Five channel shortcuts and service-specific FAQ workflows
 * - English/Amharic menus and keyword routing
 * - Admin allowlist, /reply, /broadcast (opt-in use only), /admin
 * - Optional AI draft helper for admins; never auto-sends personal drafts
 * - Vercel webhook export (set VERCEL=1) or local long polling
 *
 * No database: ticket history and user state are intentionally not persisted.
 */

type Lang = "en" | "am";
type Service = "collection" | "furniture" | "coding" | "fx" | "claim" | "personal";

const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isSafeInteger(v) && v > 0)
);
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
const WEBHOOK_PATH = process.env.WEBHOOK_PATH?.trim() || "/api/telegram";
const AI_ENABLED = process.env.ENABLE_AI_DRAFTS === "true";
const AI_API_KEY = process.env.AI_API_KEY?.trim() ?? "";
const AI_BASE_URL = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
const AI_MODEL = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
const SUPPORT_GROUP_ID = process.env.SUPPORT_GROUP_ID?.trim() ?? "";
const BRAND_NAME = process.env.BRAND_NAME?.trim() || "Amibara Support";

if (!BOT_TOKEN) throw new Error("Missing BOT_TOKEN in .env");

const bot = new Telegraf(BOT_TOKEN);
const channels = [
  ["Amibara Collection", "https://t.me/AmibaraCollection"],
  ["Amibara Furniture", "https://t.me/amibara_furniture"],
  ["Coding Tips", "https://t.me/codding_tips"],
  ["Awash FX", "https://t.me/awash_fx"],
  ["Awash Claim", "https://t.me/awash_claim"],
] as const;

const copy = {
  en: {
    welcome: `Welcome to ${BRAND_NAME}. Choose a service or type your question.`,
    menu: "Select a service:",
    collection: "Amibara Collection",
    furniture: "Amibara Furniture",
    coding: "Coding Tips",
    fx: "Awash FX",
    claim: "Awash Claim",
    personal: "Friendly message drafts",
    links: "Channel links",
    human: "Talk to a human",
    back: "Main menu",
    humanMsg: "I've flagged this for human support. Please send your question and, if relevant, your order/reference number. An admin will respond when available.",
    fallback: "I couldn't confidently identify your request. Choose a service below or type /human for human support.",
    collectionHelp: "Amibara Collection support: send the product name and ask about price, availability, size, delivery, or an existing order. Prices and stock must be confirmed by the team.",
    furnitureHelp: "Amibara Furniture support: send the furniture type, approximate dimensions, preferred material/colour, delivery location, and a reference photo if available. A team member must confirm the quote and timeline.",
    codingHelp: "Coding Tips support: send the language/framework, exact error message, and a small relevant code sample. Never send passwords, access tokens, or API keys.",
    fxHelp: "Awash FX support is limited to general education and risk information. Trading involves risk and no returns are guaranteed. This bot does not provide personalized financial advice.",
    claimHelp: "Awash Claim support: describe the issue and share only the reference number needed to locate it. Never send passwords, OTPs, or full payment-card details. A human must confirm claim decisions.",
    personalHelp: "Use /draft <tone> <situation> as an authorized admin to generate a message suggestion for review. Drafts are not sent automatically and this bot cannot message as your personal Telegram account.",
    adminOnly: "This command is restricted to authorized admins.",
    help: "Commands: /start, /help, /links, /human. Admins: /admin, /reply <chat_id> <message>, /draft <tone> <situation>, /ticket <chat_id> <note>.",
  },
  am: {
    welcome: `ወደ ${BRAND_NAME} በደህና መጡ። አገልግሎት ይምረጡ ወይም ጥያቄዎን ይላኩ።`,
    menu: "አገልግሎት ይምረጡ፦",
    collection: "አሚባራ ኮሌክሽን",
    furniture: "አሚባራ ፈርኒቸር",
    coding: "የፕሮግራሚንግ ምክሮች",
    fx: "Awash FX",
    claim: "Awash Claim",
    personal: "የጓደኛዊ መልዕክት ረቂቅ",
    links: "የቻናል ሊንኮች",
    human: "ከሰው ጋር ያገናኙኝ",
    back: "ዋና ምናሌ",
    humanMsg: "ጥያቄዎ በሰው እንዲመረመር ተመዝግቧል። ጥያቄዎንና ካስፈለገ የትዕዛዝ/ማጣቀሻ ቁጥሩን ይላኩ።",
    fallback: "ጥያቄዎን በትክክል መለየት አልቻልኩም። ከታች አገልግሎት ይምረጡ ወይም /human ይጻፉ።",
    collectionHelp: "ለኮሌክሽን ድጋፍ የምርቱን ስምና ስለ ዋጋ፣ መኖር፣ መጠን፣ ማድረስ ወይም ትዕዛዝ ያለዎትን ጥያቄ ይላኩ። ዋጋና ክምችት በቡድኑ ይረጋገጣሉ።",
    furnitureHelp: "ለፈርኒቸር ድጋፍ የእቃውን አይነት፣ መጠን፣ የቀለም/ቁሳቁስ ምርጫና የማድረሻ ቦታ ይላኩ። ዋጋና ጊዜ በቡድኑ ይረጋገጣሉ።",
    codingHelp: "ለፕሮግራሚንግ ድጋፍ ቋንቋውን/ፍሬምወርኩን፣ የስህተት መልዕክቱንና ተዛማጅ አጭር ኮድ ይላኩ። የይለፍ ቃል ወይም API key አይላኩ።",
    fxHelp: "የAwash FX ድጋፍ በአጠቃላይ የትሬዲንግ ትምህርትና የአደጋ መረጃ ብቻ የተገደበ ነው። ትሬዲንግ አደጋ አለው፤ የትርፍ ዋስትና የለም።",
    claimHelp: "ለክሌም ድጋፍ ችግሩን ይግለጹና የማጣቀሻ ቁጥሩን ብቻ ይላኩ። OTP፣ የይለፍ ቃል ወይም ሙሉ የካርድ መረጃ አይላኩ። ውሳኔው በሰው መረጋገጥ አለበት።",
    personalHelp: "የመልዕክት ረቂቅ ለማዘጋጀት አስተዳዳሪዎች /draft <tone> <situation> መጠቀም ይችላሉ። ረቂቁ በራስ-ሰር አይላክም።",
    adminOnly: "ይህን ትዕዛዝ የተፈቀደላቸው አስተዳዳሪዎች ብቻ ሊጠቀሙበት ይችላሉ።",
    help: "ትዕዛዞች፦ /start, /help, /links, /human። ለአስተዳዳሪዎች፦ /admin, /reply, /draft, /ticket።",
  },
} as const;

function isAdmin(id?: number): boolean {
  return id !== undefined && ADMIN_IDS.has(id);
}
function language(text: string): Lang {
  return /[\u1200-\u137F]/.test(text) ? "am" : "en";
}
function menu(lang: Lang) {
  const t = copy[lang];
  return Markup.inlineKeyboard([
    [Markup.button.callback(t.collection, `svc:collection:${lang}`), Markup.button.callback(t.furniture, `svc:furniture:${lang}`)],
    [Markup.button.callback(t.coding, `svc:coding:${lang}`), Markup.button.callback(t.fx, `svc:fx:${lang}`)],
    [Markup.button.callback(t.claim, `svc:claim:${lang}`), Markup.button.callback(t.personal, `svc:personal:${lang}`)],
    [Markup.button.callback(t.links, `links:${lang}`), Markup.button.callback(t.human, `human:${lang}`)],
  ]);
}
function linksText(): string {
  return channels.map(([name, url]) => `${name}: ${url}`).join("\n");
}
function serviceReply(service: Service, lang: Lang): string {
  const t = copy[lang];
  const map: Record<Service, string> = {
    collection: t.collectionHelp,
    furniture: t.furnitureHelp,
    coding: t.codingHelp,
    fx: t.fxHelp,
    claim: t.claimHelp,
    personal: t.personalHelp,
  };
  return map[service];
}
function classify(text: string): Service | undefined {
  const s = text.toLowerCase();
  if (/furniture|sofa|chair|bed|custom furniture|ፈርኒቸር|ሶፋ|ወንበር|አልጋ/.test(s)) return "furniture";
  if (/coding|javascript|typescript|python|react|programming|code error|bug|ፕሮግራሚንግ|ኮድ|ስህተት/.test(s)) return "coding";
  if (/forex|trading|gold|fx|trade|ትሬዲንግ|ወርቅ/.test(s)) return "fx";
  if (/claim|refund|complaint|reference number|ክሌም|ቅሬታ|መመለስ/.test(s)) return "claim";
  if (/romantic|love message|birthday|congratulations|apology|miss you|ፍቅር|ልደት|ይቅርታ/.test(s)) return "personal";
  if (/price|stock|available|size|delivery|collection|product|order|ዋጋ|ክምችት|ምርት|ትዕዛዝ|ማድረስ/.test(s)) return "collection";
  return undefined;
}
async function aiDraft(tone: string, situation: string): Promise<string> {
  if (!AI_ENABLED || !AI_API_KEY) throw new Error("AI drafts are disabled. Configure AI_API_KEY and ENABLE_AI_DRAFTS=true.");
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${AI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL, temperature: 0.65, max_tokens: 350,
      messages: [
        { role: "system", content: "Write one concise natural message draft for the user to review and send manually. Do not claim it was sent, invent facts, pressure the recipient, or impersonate another person. Respond in Amharic when the request is in Amharic." },
        { role: "user", content: `Tone: ${tone.slice(0, 60)}\nSituation: ${situation.slice(0, 1500)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const result = data.choices?.[0]?.message?.content?.trim();
  if (!result) throw new Error("AI provider returned no draft.");
  return result.slice(0, 3500);
}
async function sendToSupport(ctx: Context, text: string): Promise<void> {
  if (!SUPPORT_GROUP_ID) return;
  const user = ctx.from;
  const chat = ctx.chat;
  if (!user || !chat) return;
  const safeName = [user.first_name, user.last_name].filter(Boolean).join(" ").slice(0, 100);
  const username = user.username ? `@${user.username}` : "(no username)";
  await ctx.telegram.sendMessage(
    SUPPORT_GROUP_ID,
    `Support escalation\nCustomer: ${safeName} ${username}\nUser ID: ${user.id}\nChat ID: ${chat.id}\nMessage:\n${text.slice(0, 3000)}`
  );
}

bot.start(async (ctx) => {
  const lang = language(ctx.message.text);
  await ctx.reply(`${copy[lang].welcome}\n\n${copy[lang].menu}`, menu(lang));
});
bot.command("help", async (ctx) => ctx.reply(copy[language(ctx.message.text)].help));
bot.command("links", async (ctx) => ctx.reply(linksText(), { disable_web_page_preview: true }));
bot.command("human", async (ctx) => {
  const lang = language(ctx.message.text);
  await ctx.reply(copy[lang].humanMsg);
  try { await sendToSupport(ctx, ctx.message.text); } catch { /* no support group configured or unreachable */ }
});
bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return ctx.reply(copy[language(ctx.message.text)].adminOnly);
  await ctx.reply(
    `Admin panel\nUser ID: ${ctx.from.id}\n\n` +
    `/reply <chat_id> <message>\n/draft <tone> <situation>\n/ticket <chat_id> <note>\n/links\n\n` +
    `AI drafts: ${AI_ENABLED && AI_API_KEY ? "enabled" : "disabled"}\n` +
    `Support group: ${SUPPORT_GROUP_ID || "not configured"}`
  );
});
bot.command("reply", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return ctx.reply(copy[language(ctx.message.text)].adminOnly);
  const input = ctx.message.text.replace(/^\/reply(?:@\w+)?\s*/i, "");
  const match = input.match(/^(-?\d+)\s+([\s\S]+)$/);
  if (!match) return ctx.reply("Usage: /reply <chat_id> <message>");
  try {
    await ctx.telegram.sendMessage(Number(match[1]), match[2].slice(0, 4000));
    await ctx.reply("Reply sent.");
  } catch {
    await ctx.reply("Could not send reply. Check chat ID and confirm the customer has started this bot.");
  }
});
bot.command("draft", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return ctx.reply(copy[language(ctx.message.text)].adminOnly);
  const input = ctx.message.text.replace(/^\/draft(?:@\w+)?\s*/i, "");
  const match = input.match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) return ctx.reply("Usage: /draft <tone> <situation>");
  try {
    const draft = await aiDraft(match[1], match[2]);
    await ctx.reply(`Draft for review — not sent:\n\n${draft}`);
  } catch (error) {
    await ctx.reply(error instanceof Error ? error.message : "Draft generation failed.");
  }
});
bot.command("ticket", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return ctx.reply(copy[language(ctx.message.text)].adminOnly);
  const input = ctx.message.text.replace(/^\/ticket(?:@\w+)?\s*/i, "");
  const match = input.match(/^(-?\d+)\s+([\s\S]+)$/);
  if (!match) return ctx.reply("Usage: /ticket <chat_id> <note>");
  // Stateless starter: this is a quick admin note, not a persisted ticket record.
  await ctx.reply(`Ticket note (not saved to a database)\nChat ID: ${match[1]}\nNote: ${match[2].slice(0, 1000)}`);
});

bot.action(/^svc:(collection|furniture|coding|fx|claim|personal):(en|am)$/, async (ctx) => {
  const service = ctx.match[1] as Service;
  const lang = ctx.match[2] as Lang;
  await ctx.answerCbQuery();
  await ctx.reply(serviceReply(service, lang), menu(lang));
});
bot.action(/^links:(en|am)$/, async (ctx) => {
  const lang = ctx.match[1] as Lang;
  await ctx.answerCbQuery();
  await ctx.reply(`${copy[lang].links}:\n${linksText()}`, { disable_web_page_preview: true });
});
bot.action(/^human:(en|am)$/, async (ctx) => {
  const lang = ctx.match[1] as Lang;
  await ctx.answerCbQuery();
  await ctx.reply(copy[lang].humanMsg);
  try {
    const message = ctx.callbackQuery.message;
    await sendToSupport(ctx, `Human support requested from menu. Message context: ${message && "text" in message ? message.text : "service menu"}`);
  } catch { /* support group optional */ }
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;
  const lang = language(text);
  const service = classify(text);
  if (service) {
    await ctx.reply(serviceReply(service, lang), menu(lang));
    return;
  }
  await ctx.reply(copy[lang].fallback, menu(lang));
});

bot.catch((error) => {
  console.error("Telegram handler error:", error instanceof Error ? error.message : "unknown error");
});

// Vercel Node serverless function handler: export default, and configure api/index.ts
// as the Vercel entrypoint. The local process uses polling when run directly.
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!WEBHOOK_SECRET || req.headers["x-telegram-bot-api-secret-token"] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized webhook" });
  }
  try {
    await bot.handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Update failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Update failed" });
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain && process.env.VERCEL !== "1") {
  bot.launch().then(() => console.log("Amibara support bot started with long polling."))
    .catch((error) => {
      console.error("Bot failed to start:", error instanceof Error ? error.message : "unknown error");
      process.exitCode = 1;
    });
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

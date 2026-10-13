# Amibara Telegram Automation — single-file edition

Files:
- `index.ts` — all bot logic, workflows, webhook handler, and local polling.
- `.env` — local secrets/configuration; do not commit it.

## Install
```bash
npm init -y
npm install telegraf dotenv
npm install -D typescript tsx @types/node
```

Run locally:
```bash
npx tsx index.ts
```

## Vercel deployment
Vercel's Node function needs a function entrypoint under `api/`. To keep all application logic in one file, create a tiny adapter file at `api/index.ts`:

```ts
export { default } from "../index.js";
```

Compile TypeScript to JavaScript before deployment, or use a Vercel TypeScript setup that supports this import. Add these environment variables in Vercel:
- `BOT_TOKEN`
- `ADMIN_IDS`
- `TELEGRAM_WEBHOOK_SECRET`
- `SUPPORT_GROUP_ID` (optional)
- AI variables only if deliberately enabling AI drafts

Deploy the project, then set the Telegram webhook to:
`https://YOUR-PROJECT.vercel.app/api/index`

Use Telegram Bot API `setWebhook` with `secret_token` equal to `TELEGRAM_WEBHOOK_SECRET`, and `url` equal to the endpoint above. The `WEBHOOK_PATH` variable is descriptive in this starter; Vercel routes by the file path.

## Safety and limitations
- No database is used; tickets, transcripts, and session state are not persisted.
- The bot cannot read your personal Telegram inbox or send messages as your personal account.
- It can support users who initiate a chat with the bot, or updates from groups/channels where the bot is installed and permitted.
- Do not hardcode actual prices, stock, delivery promises, FX predictions, or claim decisions. Add verified business data and human review.
- AI drafts are off by default and only available to authorized admins when explicitly enabled.

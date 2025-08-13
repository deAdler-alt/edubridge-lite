# Telegram Bot

## Setup
1. **Create bot**: talk to @BotFather → `/newbot` → copy **TOKEN**.
2. **Vercel env**: Project → Settings → Environment Variables  
   `TELEGRAM_BOT_TOKEN = <your token>`
3. **Deploy** your app.
4. **Set webhook**:
```

curl -s "[https://api.telegram.org/bot](https://api.telegram.org/bot)<TOKEN>/setWebhook?url=https\://<your-app>.vercel.app/api/telegram"
curl -s "[https://api.telegram.org/bot](https://api.telegram.org/bot)<TOKEN>/getWebhookInfo"

```

## Usage
- `/start`, `/help`
- `pl: <text>` or `en: <text>`
- Send a **URL**; bot fetches and generates a pack.

## Security (recommended)
- Use `setWebhook` with `secret_token` and validate header `X-Telegram-Bot-Api-Secret-Token` in the handler.

## Troubleshooting
- Check Vercel **Functions → Invocation Logs**.
- 403 on webhook → bad token.  
- No replies → env var missing or webhook not set.
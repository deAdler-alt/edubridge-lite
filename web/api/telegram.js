// web/api/telegram.js
// Minimal Telegram webhook for EduBridge Lite (Vercel Serverless Function)
// Env vars (Vercel → Project Settings → Environment Variables):
// - TELEGRAM_BOT_TOKEN
// - APP_URL (optional, e.g., https://twoj-projekt.vercel.app)

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null
const APP_URL = process.env.APP_URL || ''

function genLitePack(text, lang = 'en') {
  const clean = String(text || '').trim().replace(/\s+/g, ' ')
  const words = clean.split(' ').filter(Boolean)
  const sumLen = Math.min(6, Math.max(3, Math.floor(words.length / 30)))
  const summary = Array.from({ length: sumLen }).map((_, i) => {
    const start = i * 12
    return '• ' + words.slice(start, start + 12).join(' ')
  })
  const easy = (lang === 'pl' ? 'Wersja prostym językiem: ' : 'Easy language: ') + clean.slice(0, 400)
  return { summary, easy }
}

async function send(chatId, text) {
  if (!API) return
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
}

// Helper: parse JSON body safely (Vercel Node function may not populate req.body)
async function readBody(req) {
  try {
    if (req.body) return req.body
    let data = ''
    for await (const chunk of req) data += chunk
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, info: 'POST from Telegram only' })
  }

  const body = await readBody(req)
  const msg = body.message || body.edited_message || (body.callback_query && body.callback_query.message) || {}
  const chatId = msg.chat && msg.chat.id
  const text = (msg.text || '').trim()
  const lang = (msg.from && msg.from.language_code && msg.from.language_code.startsWith('pl')) ? 'pl' : 'en'

  if (!TOKEN || !API) {
    if (chatId) await send(chatId, 'Bot misconfigured: missing TELEGRAM_BOT_TOKEN')
    return res.status(200).json({ ok: false, error: 'Missing token' })
  }
  if (!chatId) {
    return res.status(200).json({ ok: true })
  }

  try {
    if (text.startsWith('/start')) {
      const t = lang === 'pl'
        ? 'Cześć! Wyślij /pack i po spacji wklej tekst, a zrobię Lite Pack.\nPrzykład:\n/pack Fotosynteza to proces ...'
        : 'Hi! Send /pack and paste some text to get a Lite Pack.\nExample:\n/pack Photosynthesis is the process ...'
      await send(chatId, t)
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/help')) {
      const t = lang === 'pl'
        ? 'Użycie: /pack <twój tekst>. Otrzymasz skrót i Easy Language.' + (APP_URL ? `\nPełna aplikacja: ${APP_URL}` : '')
        : 'Usage: /pack <your text>. You will get a short pack + Easy Language.' + (APP_URL ? `\nFull app: ${APP_URL}` : '')
      await send(chatId, t)
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/pack')) {
      const payload = text.replace(/^\/pack\s*/i, '')
      if (!payload || payload.length < 20) {
        const t = lang === 'pl'
          ? 'Wklej proszę dłuższy tekst po /pack (min. 20 znaków).'
          : 'Please paste more text after /pack (min. 20 characters).'
        await send(chatId, t)
        return res.status(200).json({ ok: true })
      }
      const pack = genLitePack(payload, lang)
      const out = [
        lang === 'pl' ? '📦 Lite Pack (skrót)' : '📦 Lite Pack (short)',
        '',
        (lang === 'pl' ? 'Podsumowanie:' : 'Summary:'),
        ...pack.summary,
        '',
        pack.easy,
        '',
        (APP_URL ? (lang === 'pl' ? `Pełna wersja: ${APP_URL}` : `Full app: ${APP_URL}`) : '')
      ].filter(Boolean).join('\n')
      await send(chatId, out.slice(0, 3800)) // Telegram limit safety
      return res.status(200).json({ ok: true })
    }

    // default
    const t = lang === 'pl'
      ? 'Nieznana komenda. Użyj /pack lub /help.'
      : 'Unknown command. Use /pack or /help.'
    await send(chatId, t)
    return res.status(200).json({ ok: true })

  } catch (e) {
    console.error('telegram webhook error', e)
    // Zwróć 200, aby Telegram nie powtarzał w kółko tego samego update
    return res.status(200).json({ ok: true })
  }
}

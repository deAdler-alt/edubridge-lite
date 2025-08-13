// web/api/telegram.js
// Telegram webhook → przyjmuje tekst lub URL, generuje Lite Pack (offline heurystyki)
// i odsyła 3–4 wiadomości: Key Points, Easy, Flashcards, Quiz.
// Wymaga: TELEGRAM_BOT_TOKEN = "123456:ABC..." (Vercel Project → Settings → Environment Variables)

import { generateLitePack } from '../src/lib/generator.js'

// Bezpieczne czytanie JSON body (Vercel Node)
async function readJson(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  return await new Promise((resolve) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
    })
  })
}

async function sendMessage(chatId, text) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
}

async function sendLongMessage(chatId, text) {
  const LIMIT = 3900 // bufor pod limity Telegrama
  if (text.length <= LIMIT) return sendMessage(chatId, text)
  let t = text
  while (t.length > LIMIT) {
    let cut = t.lastIndexOf('\n', LIMIT)
    if (cut < LIMIT * 0.6) cut = LIMIT
    await sendMessage(chatId, t.slice(0, cut).trim())
    t = t.slice(cut)
  }
  if (t.trim()) await sendMessage(chatId, t.trim())
}

function looksLikeUrl(s) {
  return /\bhttps?:\/\/\S+/i.test(s)
}

async function extractText(url) {
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml'
      }
    })
    if (!r.ok) return ''
    const html = await r.text()
    const { parse } = await import('node-html-parser')
    const root = parse(html, { script: true, style: true, pre: true })

    // Wytnij śmieci
    ;['script','style','noscript','svg','canvas','nav','footer','header','aside','iframe','.ads','.advert','.promo']
      .forEach(sel => root.querySelectorAll(sel).forEach(n => n.remove()))

    // Znajdź największy blok treści
    const candidates = ['article','main','[role="main"]','.content','.post-content','.entry-content','#content','#main','.article','.post','.story']
    let best = null, bestLen = 0
    for (const sel of candidates) {
      const nodes = root.querySelectorAll(sel)
      for (const node of nodes) {
        const len = (node.innerText || '').length
        if (len > bestLen) { best = node; bestLen = len }
      }
      if (bestLen > 800) break
    }
    const target = best || root.querySelector('body') || root

    // Zbierz sensowne bloki
    const blocks = []
    target.querySelectorAll('p,li,blockquote,pre,code,h1,h2,h3').forEach(el => {
      const t = (el.innerText || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim()
      if (t && t.length >= 30) blocks.push(t)
    })
    const text = (blocks.length ? blocks.join('\n\n') : (target.innerText || '').trim()).replace(/\r/g, '')
    return text.slice(0, 5000)
  } catch {
    return ''
  }
}

export default async function handler(req, res) {
  // GET/HEAD → OK (Telegram może odpalać health-checki)
  if (req.method !== 'POST') {
    res.status(200).send('OK')
    return
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    res.status(200).json({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' })
    return
  }

  const update = await readJson(req)
  const msg = update?.message
  const chatId = msg?.chat?.id
  const textRaw = (msg?.text || '').trim()

  if (!chatId || !textRaw) {
    res.status(200).json({ ok: true })
    return
  }

  // Komendy
  if (/^\/start/i.test(textRaw)) {
    await sendMessage(chatId,
      'Hi! Send me a lesson text (min. 20 chars) or a link.\n' +
      'Language: use prefix "pl: ..." for Polish or "en: ..." for English.\n' +
      'Example: pl: Fotosynteza to proces...'
    )
    res.status(200).json({ ok: true })
    return
  }
  if (/^\/help/i.test(textRaw)) {
    await sendMessage(chatId,
      'Help:\n' +
      '- Paste text or a URL (http/https).\n' +
      '- Prefix with "pl:" or "en:" to force language.\n' +
      '- I will reply with Key Points, Easy, Flashcards, and Quiz.'
    )
    res.status(200).json({ ok: true })
    return
  }

  // Język
  let lang = 'en'
  if (/^pl:|^\/pl\b|^lang\s*pl\b/i.test(textRaw) || (msg?.from?.language_code || '').startsWith('pl')) lang = 'pl'
  if (/^en:|^\/en\b|^lang\s*en\b/i.test(textRaw)) lang = 'en'

  // Oczyść prefix języka
  let text = textRaw.replace(/^(pl:|en:)\s*/i, '').replace(/^\/(pl|en)\b/i, '').replace(/^lang\s*(pl|en)\b/i, '').trim()

  // URL → ekstrakcja
  if (looksLikeUrl(text)) {
    await sendMessage(chatId, lang === 'pl' ? 'Pobieram artykuł…' : 'Fetching article…')
    const url = (text.match(/\bhttps?:\/\/\S+/i) || [])[0] || text
    const extracted = await extractText(url)
    if (!extracted || extracted.length < 50) {
      await sendMessage(chatId, lang === 'pl'
        ? 'Nie udało się pobrać tekstu. Wklej treść ręcznie lub podaj inny link.'
        : 'Could not extract readable text. Please paste content or send another link.'
      )
      res.status(200).json({ ok: true })
      return
    }
    text = extracted
  }

  if (text.length < 20) {
    await sendMessage(chatId, lang === 'pl'
      ? 'Wyślij tekst (min. 20 znaków) lub link.'
      : 'Send text (min. 20 chars) or a link.'
    )
    res.status(200).json({ ok: true })
    return
  }

  await sendMessage(chatId, lang === 'pl' ? 'Generuję pakiet…' : 'Generating pack…')
  let pack
  try {
    pack = await generateLitePack(text, lang)
  } catch {
    await sendMessage(chatId, lang === 'pl'
      ? 'Błąd podczas generowania. Spróbuj krótszy tekst.'
      : 'Error while generating. Try a shorter text.'
    )
    res.status(200).json({ ok: true })
    return
  }

  // Link do wersji web (ten sam host)
  const baseUrl =
    (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://` : 'https://') +
    (req.headers.host || '')
  const linkText = lang === 'pl' ? `Pełna wersja online: ${baseUrl}` : `Open full online: ${baseUrl}`

  // 1) Key Points
  const kpHeader = lang === 'pl' ? 'Kluczowe punkty:' : 'Key Points:'
  const kp = (pack.summary || []).slice(0, 5).map(s => `• ${s}`).join('\n')
  await sendLongMessage(chatId, `${kpHeader}\n${kp}`)

  // 2) Easy
  const easyHeader = lang === 'pl' ? 'Wersja łatwiejsza:' : 'Easy language:'
  await sendLongMessage(chatId, `${easyHeader}\n${pack.easy || ''}`)

  // 3) Flashcards (top 5, żeby nie przeginać limitów)
  const fHeader = 'Flashcards:'
  const fBody = (pack.flashcards || []).slice(0, 5).map((f, i) => `Q${i + 1}: ${f.q}\nA: ${f.a}`).join('\n\n')
  if (fBody) await sendLongMessage(chatId, `${fHeader}\n${fBody}`)

  // 4) Quiz (top 3)
  const qHeader = 'Quiz:'
  const qBody = (pack.quiz || []).slice(0, 3).map((q, i) => {
    if (Array.isArray(q.options) && q.options.length === 4) {
      return `${i + 1}. ${q.q}\nA) ${q.options[0]}  B) ${q.options[1]}  C) ${q.options[2]}  D) ${q.options[3]}`
    }
    return `${i + 1}. ${q.q} (A/B/C/D)`
  }).join('\n\n')
  if (qBody) await sendLongMessage(chatId, `${qHeader}\n${qBody}\n\n${linkText}`)

  res.status(200).json({ ok: true })
}

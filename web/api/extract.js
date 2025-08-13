import { parse } from 'node-html-parser'

const MAX_CHARS = 5000

export default async function handler(req, res) {
  try {
    const url = getUrlParam(req)
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(200).json({ ok: false, error: 'Invalid or missing url param' })
    }

    const html = await fetchHtml(url)
    if (!html) {
      return res.status(200).json({ ok: false, error: 'Failed to fetch page' })
    }

    const { title, text } = extractArticle(html)
    if (!text || text.trim().length < 50) {
      return res.status(200).json({ ok: false, error: 'Could not extract readable text' })
    }

    const trimmed = text.trim().replace(/\n{3,}/g, '\n\n').slice(0, MAX_CHARS)
    return res.status(200).json({
      ok: true,
      title: (title || '').trim().slice(0, 160),
      text: trimmed
    })
  } catch (e) {
    console.error('extract error', e)
    return res.status(200).json({ ok: false, error: 'Unexpected error' })
  }
}

// --- helpers ---

function getUrlParam(req) {
  try {
    // Vercel (Node) gives req.url with query string
    const base = 'https://dummy.local' // required by WHATWG URL when no absolute
    const u = new URL(req.url, base)
    return u.searchParams.get('url') || ''
  } catch {
    return ''
  }
}

async function fetchHtml(targetUrl) {
  try {
    const r = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        // Friendly UA; czasem pomaga ominąć proste blokady
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml'
      }
    })
    if (!r.ok) return null
    const ct = r.headers.get('content-type') || ''
    if (!ct.includes('text/html')) {
      // nadal spróbujemy — część serwisów ma nietypowe nagłówki
    }
    return await r.text()
  } catch {
    return null
  }
}

function extractArticle(html) {
  const root = parse(html, {
    lowerCaseTagName: false,
    script: true,
    style: true,
    pre: true,
    comment: false
  })

  // Title
  const title = (root.querySelector('title')?.text || '').trim()

  // Remove noisy nodes
  const noisySelectors = [
    'script', 'style', 'noscript', 'svg', 'canvas', 'form',
    'nav', 'footer', 'header', 'aside', 'iframe', 'ads', '.ads', '.advert', '.promo'
  ]
  noisySelectors.forEach(sel => {
    root.querySelectorAll(sel).forEach(n => n.remove())
  })

  // Candidate containers
  const candidates = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '#content',
    '#main',
    '.article',
    '.post',
    '.story'
  ]

  let bestNode = null
  let bestScore = 0

  // Pick the container with the biggest amount of text
  for (const sel of candidates) {
    const nodes = root.querySelectorAll(sel)
    nodes.forEach(node => {
      const t = textFromNode(node)
      const score = t.length
      if (score > bestScore) {
        bestScore = score
        bestNode = node
      }
    })
    if (bestScore > 800) break // good enough
  }

  // Fallback: use body paragraphs
  const target = bestNode || root.querySelector('body') || root

  const text = collectReadableText(target)
  return { title, text }
}

function textFromNode(node) {
  return (node?.innerText || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectReadableText(container) {
  if (!container) return ''
  const blocks = []
  const keepTags = new Set(['p', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3'])

  // gather paragraphs/headings
  container.querySelectorAll('*').forEach(el => {
    const tag = el.tagName?.toLowerCase?.() || ''
    if (keepTags.has(tag)) {
      const raw = (el.innerText || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim()
      if (raw && raw.length >= 30) {
        blocks.push(raw)
      }
    }
  })

  // if nothing found, fallback to all text
  if (blocks.length === 0) {
    const raw = (container.innerText || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim()
    return raw
  }

  return blocks.join('\n\n')
}

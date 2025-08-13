// web/src/lib/pdf.js
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

// --- Layout (pt) ---
const MARGIN = 40
const QR_SIZE = 72
const FOOTER_GAP = 14

const FS_TITLE = 20
const FS_SECTION = 15
const FS_BODY = 11

const LH_TITLE = 28
const LH_SECTION = 20
const LH_BODY = 18

const SP_BEFORE_SECTION = 28
const SP_AFTER_HEADING = 12

function footerHeight() {
  // wysokość potrzebna na stopkę (tekst + QR)
  return Math.max(QR_SIZE + 8, 92)
}

function ensureSpace(doc, y, needed) {
  const pageH = doc.internal.pageSize.getHeight()
  const limit = pageH - MARGIN - footerHeight()
  if (y + needed > limit) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function addWrapped(doc, text, x, y, maxWidth, lineHeight) {
  if (!text) return y
  const lines = doc.splitTextToSize(String(text), maxWidth)
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight)
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function addList(doc, items, x, y, maxWidth) {
  const arr = Array.isArray(items) ? items : []
  for (const it of arr) {
    const lines = doc.splitTextToSize(`• ${String(it)}`, maxWidth)
    for (const ln of lines) {
      y = ensureSpace(doc, y, LH_BODY)
      doc.text(ln, x, y)
      y += LH_BODY
    }
  }
  return y
}

function addHeading(doc, text, y) {
  y += SP_BEFORE_SECTION
  y = ensureSpace(doc, y, LH_SECTION)
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(FS_SECTION)
  doc.text(String(text), MARGIN, y)
  y += SP_AFTER_HEADING
  doc.setFont('NotoSans', 'normal'); doc.setFontSize(FS_BODY)
  return y
}

// ---- Unicode font loader (TTF -> base64 -> VFS) ----
function uint8ToBase64(u8) {
  // bezpieczna konwersja dużych plików (chunkowanie)
  let res = ''
  const CHUNK = 0x8000
  for (let i = 0; i < u8.length; i += CHUNK) {
    res += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK))
  }
  return btoa(res)
}

async function addTtfToDoc(doc, url, vfsName, fontName, style) {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Font fetch failed: ' + url)
  const buf = await r.arrayBuffer()
  const base64 = uint8ToBase64(new Uint8Array(buf))
  doc.addFileToVFS(vfsName, base64)
  doc.addFont(vfsName, fontName, style)
}

async function ensureFonts(doc) {
  try {
    await addTtfToDoc(doc, '/fonts/NotoSans-Regular.ttf', 'NotoSans-Regular.ttf', 'NotoSans', 'normal')
    await addTtfToDoc(doc, '/fonts/NotoSans-Bold.ttf', 'NotoSans-Bold.ttf', 'NotoSans', 'bold')
    doc.setFont('NotoSans', 'normal')
    return true
  } catch (e) {
    console.warn('PDF font load failed, fallback to core font. Reason:', e)
    doc.setFont('helvetica', 'normal')
    return false
  }
}

export async function exportPackToPdf(
  pack,
  { title = 'Lite Pack', lang = 'en', appUrl = '' } = {}
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - MARGIN * 2

  // 1) Unicode font (PL ogonki itp.)
  await ensureFonts(doc)
  doc.setFontSize(FS_BODY)
  doc.setLineHeightFactor(1.0) // używamy naszych LH_*

  // 2) Tytuł — owinięty, od razu na stronie (nie wyjedzie)
  let y = MARGIN
  {
    const lines = doc.splitTextToSize(String(title), maxW)
    doc.setFont('NotoSans', 'bold'); doc.setFontSize(FS_TITLE)
    for (const ln of lines) {
      y = ensureSpace(doc, y, LH_TITLE)
      doc.text(ln, MARGIN, y)
      y += LH_TITLE
    }
    doc.setFont('NotoSans', 'normal'); doc.setFontSize(FS_BODY)
  }

  // 3) Sekcje
  // Summary / Podsumowanie
  y = addHeading(doc, lang === 'pl' ? 'Podsumowanie' : 'Summary', y)
  y = addList(doc, pack.summary || [], MARGIN, y, maxW)

  // Easy Language
  y = addHeading(doc, lang === 'pl' ? 'Wersja łatwiejsza' : 'Easy Language', y)
  y = addWrapped(doc, String(pack.easy || ''), MARGIN, y, maxW, LH_BODY)

  // Flashcards
  y = addHeading(doc, 'Flashcards', y)
  const ftext = (pack.flashcards || [])
    .map(f => `Q: ${f.q}\nA: ${f.a}`)
    .join('\n\n')
  y = addWrapped(doc, ftext, MARGIN, y, maxW, LH_BODY)

  // Quiz
  y = addHeading(doc, 'Quiz', y)
  const qtext = (pack.quiz || []).map((q, i) => {
    if (Array.isArray(q.options) && q.options.length === 4) {
      const letters = ['A', 'B', 'C', 'D']
      const opts = q.options.map((o, j) => `${letters[j]}) ${o}`).join('   ')
      return `${i + 1}. ${q.q}\n${opts}`
    }
    return `${i + 1}. ${q.q} (A/B/C/D)`
  }).join('\n\n')
  y = addWrapped(doc, qtext, MARGIN, y, maxW, LH_BODY)

  // 4) Stopka (QR + link) — na sam koniec, z buforem
  if (y > pageH - MARGIN - footerHeight() + LH_BODY) {
    doc.addPage()
  }
  try {
    const link = appUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    if (link) {
      const dataUrl = await QRCode.toDataURL(link, { width: QR_SIZE, margin: 0 })
      doc.setFont('NotoSans', 'normal'); doc.setFontSize(10)
      const footerY = pageH - FOOTER_GAP
      doc.text(lang === 'pl' ? 'Otwórz online:' : 'Open online:', MARGIN, footerY)
      doc.text(link, MARGIN + 100, footerY)
      doc.addImage(
        dataUrl, 'PNG',
        pageW - MARGIN - QR_SIZE,
        pageH - MARGIN - QR_SIZE,
        QR_SIZE, QR_SIZE
      )
    }
  } catch {}

  const safe = String(title).replace(/[\\/:*?"<>|]/g, '_')
  doc.save(`${safe}.pdf`)
}

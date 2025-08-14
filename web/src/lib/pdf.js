// web/src/lib/pdf.js
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

const MARGIN = 40
const QR_SIZE = 72
const FOOTER_GAP = 14

const FS_TITLE = 17
const FS_SECTION = 15
const FS_BODY = 10

const LH_TITLE = 28
const LH_SECTION = 22
const LH_BODY = 20 

const SP_BEFORE_SECTION = 36 
const SP_AFTER_HEADING = 20  

function footerHeight () {
  return Math.max(QR_SIZE + 8, 92)
}

function pageLimitY (doc) {
  const pageH = doc.internal.pageSize.getHeight()
  return pageH - MARGIN - footerHeight()
}

function ensureSpace (doc, y, needed) {
  const limit = pageLimitY(doc)
  if (y + needed > limit) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function addWrapped (doc, text, x, y, maxWidth, lineHeight) {
  if (!text) return y
  const lines = doc.splitTextToSize(String(text), maxWidth)
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight)
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function addList (doc, items, x, y, maxWidth) {
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

function measureWrappedLines (doc, text, maxWidth) {
  if (!text) return 0
  return doc.splitTextToSize(String(text), maxWidth).length
}

function measureListLines (doc, items, maxWidth) {
  const arr = Array.isArray(items) ? items : []
  let lines = 0
  for (const it of arr) {
    lines += doc.splitTextToSize(`• ${String(it)}`, maxWidth).length
  }
  return lines
}

function addHeading (doc, text, y) {
  y += SP_BEFORE_SECTION
  y = ensureSpace(doc, y, LH_SECTION)
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(FS_SECTION)
  doc.text(String(text), MARGIN, y)
  y += SP_AFTER_HEADING
  doc.setFont('NotoSans', 'normal'); doc.setFontSize(FS_BODY)
  return y
}

function uint8ToBase64 (u8) {
  let res = ''
  const CHUNK = 0x8000
  for (let i = 0; i < u8.length; i += CHUNK) {
    res += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK))
  }
  return btoa(res)
}

async function addTtfToDoc (doc, url, vfsName, fontName, style) {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Font fetch failed: ' + url)
  const buf = await r.arrayBuffer()
  const base64 = uint8ToBase64(new Uint8Array(buf))
  doc.addFileToVFS(vfsName, base64)
  doc.addFont(vfsName, fontName, style)
}

async function ensureFonts (doc) {
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

function truncateToWidth (doc, str, maxWidth) {
  let s = String(str)
  while (s.length > 1 && doc.getTextWidth(s + '…') > maxWidth) {
    s = s.slice(0, -1)
  }
  return s + '…'
}

function drawTitle (doc, title, y, maxWidth) {
  const lines = doc.splitTextToSize(String(title), maxWidth)
  const MAX_TITLE_LINES = 3
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(FS_TITLE)
  const toDraw = lines.length <= MAX_TITLE_LINES
    ? lines
    : [...lines.slice(0, MAX_TITLE_LINES - 1), truncateToWidth(doc, lines[MAX_TITLE_LINES - 1], maxWidth)]
  for (const ln of toDraw) {
    y = ensureSpace(doc, y, LH_TITLE)
    doc.text(ln, MARGIN, y)
    y += LH_TITLE
  }
  doc.setFont('NotoSans', 'normal'); doc.setFontSize(FS_BODY)
  return y
}

function sectionHeightForList (doc, items, maxWidth) {
  const lines = measureListLines(doc, items, maxWidth)
  return SP_BEFORE_SECTION + LH_SECTION + SP_AFTER_HEADING + lines * LH_BODY
}

function sectionHeightForParagraph (doc, text, maxWidth) {
  const lines = measureWrappedLines(doc, text, maxWidth)
  return SP_BEFORE_SECTION + LH_SECTION + SP_AFTER_HEADING + lines * LH_BODY
}

function ensureAtomicSection (doc, y, needed) {
  const limit = pageLimitY(doc)
  if (y + needed > limit) {
    doc.addPage()
    return MARGIN
  }
  return y
}

export async function exportPackToPdf (pack, { title = 'Lite Pack', lang = 'en', appUrl = '' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - MARGIN * 2

  await ensureFonts(doc)
  doc.setFontSize(FS_BODY)
  doc.setLineHeightFactor(1.0)

  let y = MARGIN
  y = drawTitle(doc, title, y, maxW)

  {
    const heading = (lang === 'pl') ? 'Podsumowanie' : 'Summary'
    const needed = sectionHeightForList(doc, pack.summary || [], maxW)
    y = ensureAtomicSection(doc, y, needed)
    y = addHeading(doc, heading, y)
    y = addList(doc, pack.summary || [], MARGIN, y, maxW)
  }

  {
    const heading = (lang === 'pl') ? 'Wersja łatwiejsza' : 'Easy Language'
    const needed = sectionHeightForParagraph(doc, String(pack.easy || ''), maxW)
    y = ensureAtomicSection(doc, y, needed)
    y = addHeading(doc, heading, y)
    y = addWrapped(doc, String(pack.easy || ''), MARGIN, y, maxW, LH_BODY)
  }

  {
    const ftext = (pack.flashcards || [])
      .map(f => `Q: ${f.q}\nA: ${f.a}`)
      .join('\n\n')
    const needed = sectionHeightForParagraph(doc, ftext, maxW)
    y = ensureAtomicSection(doc, y, needed)
    y = addHeading(doc, 'Flashcards', y)
    y = addWrapped(doc, ftext, MARGIN, y, maxW, LH_BODY)
  }

  {
    const qtext = (pack.quiz || []).map((q, i) => {
      if (Array.isArray(q.options) && q.options.length === 4) {
        const letters = ['A', 'B', 'C', 'D']
        const opts = q.options.map((o, j) => `${letters[j]}) ${o}`).join('   ')
        return `${i + 1}. ${q.q}\n${opts}`
      }
      return `${i + 1}. ${q.q} (A/B/C/D)`
    }).join('\n\n')

    const needed = sectionHeightForParagraph(doc, qtext, maxW)
    y = ensureAtomicSection(doc, y, needed)
    y = addHeading(doc, 'Quiz', y)
    y = addWrapped(doc, qtext, MARGIN, y, maxW, LH_BODY)
  }

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
      doc.addImage(dataUrl, 'PNG', pageW - MARGIN - QR_SIZE, pageH - MARGIN - QR_SIZE, QR_SIZE, QR_SIZE)
    }
  } catch {}

  const safe = String(title).replace(/[\\/:*?"<>|]/g, '_')
  doc.save(`${safe}.pdf`)
}

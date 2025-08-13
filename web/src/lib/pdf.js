// web/src/lib/pdf.js
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

const MARGIN = 40
const FOOTER_H = 100
const FS_TITLE = 22
const FS_SECTION = 14
const FS_BODY = 11
const LH_BODY = 16 // stała wysokość linii (pt)

function ensureSpace(doc, y, needed) {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + needed > pageH - MARGIN - FOOTER_H) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function addParagraph(doc, text, x, y, maxWidth) {
  if (!text) return y
  const lines = doc.splitTextToSize(String(text), maxWidth)
  for (const line of lines) {
    y = ensureSpace(doc, y, LH_BODY)
    doc.text(line, x, y)
    y += LH_BODY
  }
  return y
}

function addList(doc, items, x, y, maxWidth) {
  const arr = Array.isArray(items) ? items : []
  for (const item of arr) {
    const lines = doc.splitTextToSize(`• ${item}`, maxWidth)
    for (const ln of lines) {
      y = ensureSpace(doc, y, LH_BODY)
      doc.text(ln, x, y)
      y += LH_BODY
    }
  }
  return y
}

export async function exportPackToPdf(pack, { title = 'Lite Pack', lang = 'en', appUrl = '' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - MARGIN * 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(FS_BODY)
  doc.setLineHeightFactor(1.25)

  let y = MARGIN

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(FS_TITLE)
  y = ensureSpace(doc, y, LH_BODY + 8)
  doc.text(String(title), MARGIN, y)
  y += 12

  doc.setFont('helvetica', 'normal'); doc.setFontSize(FS_BODY)

  // Summary
  doc.setFont('helvetica', 'bold'); doc.setFontSize(FS_SECTION)
  y += 20; y = ensureSpace(doc, y, LH_BODY)
  doc.text('Summary', MARGIN, y)
  y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(FS_BODY)
  y = addList(doc, pack.summary || [], MARGIN, y, maxW)

  // Easy
  doc.setFont('helvetica', 'bold'); doc.setFontSize(FS_SECTION)
  y += 18; y = ensureSpace(doc, y, LH_BODY)
  doc.text(lang === 'pl' ? 'Wersja łatwiejsza' : 'Easy Language', MARGIN, y)
  y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(FS_BODY)
  y = addParagraph(doc, String(pack.easy || ''), MARGIN, y, maxW)

  // Flashcards
  doc.setFont('helvetica', 'bold'); doc.setFontSize(FS_SECTION)
  y += 18; y = ensureSpace(doc, y, LH_BODY)
  doc.text('Flashcards', MARGIN, y)
  y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(FS_BODY)
  const ftext = (pack.flashcards || []).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')
  y = addParagraph(doc, ftext, MARGIN, y, maxW)

  // Quiz
  doc.setFont('helvetica', 'bold'); doc.setFontSize(FS_SECTION)
  y += 18; y = ensureSpace(doc, y, LH_BODY)
  doc.text('Quiz', MARGIN, y)
  y += 10
  doc.setFont('helvetica', 'normal'); doc.setFontSize(FS_BODY)
  const qtext = (pack.quiz || []).map((q, i) => {
    if (Array.isArray(q.options) && q.options.length === 4) {
      const letters = ['A', 'B', 'C', 'D']
      const opts = q.options.map((o, j) => `${letters[j]}) ${o}`).join('   ')
      return `${i + 1}. ${q.q}\n${opts}`
    }
    return `${i + 1}. ${q.q} (A/B/C/D)`
  }).join('\n\n')
  y = addParagraph(doc, qtext, MARGIN, y, maxW)

  // Footer (QR + link) — zawsze po rezerwie
  if (y > pageH - MARGIN - FOOTER_H) {
    doc.addPage()
  }
  try {
    const link = appUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    if (link) {
      const dataUrl = await QRCode.toDataURL(link, { width: 96, margin: 0 })
      const qrSize = 72
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
      doc.text(lang === 'pl' ? 'Otwórz online:' : 'Open online:', MARGIN, pageH - MARGIN)
      doc.text(link, MARGIN + 90, pageH - MARGIN)
      doc.addImage(dataUrl, 'PNG', pageW - MARGIN - qrSize, pageH - MARGIN - qrSize, qrSize, qrSize)
    }
  } catch {}

  const safe = String(title).replace(/[\\/:*?"<>|]/g, '_')
  doc.save(`${safe}.pdf`)
}

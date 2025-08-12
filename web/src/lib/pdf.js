import jsPDF from 'jspdf'
import QRCode from 'qrcode'

function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(text, maxWidth)
  lines.forEach((line) => {
    doc.text(line, x, y)
    y += lineHeight
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      y = 20
    }
  })
  return y
}

export async function exportPackToPdf(pack, { title = 'Lite Pack', lang = 'en', appUrl = '' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  let y = margin

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  addWrappedText(doc, title, margin, y, pageW - margin * 2, 24)
  y += 8

  // Sections
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)

  // Summary
  doc.setFont('helvetica', 'bold'); doc.text('Summary', margin, (y += 20))
  doc.setFont('helvetica', 'normal')
  const bullets = (pack.summary || []).map(s => `• ${s}`).join('\n')
  y = addWrappedText(doc, bullets, margin, y + 6, pageW - margin * 2, 18)

  // Easy Language
  doc.setFont('helvetica', 'bold'); doc.text(lang === 'pl' ? 'Wersja łatwiejsza' : 'Easy Language', margin, (y += 20))
  doc.setFont('helvetica', 'normal')
  y = addWrappedText(doc, String(pack.easy || ''), margin, y + 6, pageW - margin * 2, 18)

  // Flashcards
  doc.setFont('helvetica', 'bold'); doc.text('Flashcards', margin, (y += 20))
  doc.setFont('helvetica', 'normal')
  const ftext = (pack.flashcards || []).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')
  y = addWrappedText(doc, ftext, margin, y + 6, pageW - margin * 2, 18)

  // Quiz
  doc.setFont('helvetica', 'bold'); doc.text('Quiz', margin, (y += 20))
  doc.setFont('helvetica', 'normal')
  const qtext = (pack.quiz || []).map((q, i) => `${i + 1}. ${q.q} (A/B/C/D)`).join('\n')
  y = addWrappedText(doc, qtext, margin, y + 6, pageW - margin * 2, 18)

  // Footer with QR (app URL)
  try {
    const link = appUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    if (link) {
      const dataUrl = await QRCode.toDataURL(link, { width: 96, margin: 0 })
      const qrSize = 72 // px
      // Tekst + QR w stopce
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(lang === 'pl' ? 'Otwórz online:' : 'Open online:', margin, pageH - margin)
      doc.text(link, margin + 90, pageH - margin)
      doc.addImage(dataUrl, 'PNG', pageW - margin - qrSize, pageH - margin - qrSize, qrSize, qrSize)
    }
  } catch {
  }

  // Save
  const safe = String(title).replace(/[\\/:*?"<>|]/g, '_')
  doc.save(`${safe}.pdf`)
}

// web/src/lib/ocr.js
// Tesseract.js z prostym pre-processingiem: resize do ~1600px, odszumienie, grayscale.

import Tesseract from 'tesseract.js'

export async function ocrImage(fileOrBlob, lang = 'eng', onProgress = () => {}) {
  const dataUrl = await toProcessedDataUrl(fileOrBlob, 1600) // resize & grayscale
  const res = await Tesseract.recognize(dataUrl, lang, {
    logger: m => {
      if (m && typeof m.progress === 'number') onProgress(m)
    }
  })
  return (res?.data?.text || '').replace(/\r/g, '').trim()
}

async function toProcessedDataUrl(fileOrBlob, maxW = 1600) {
  const img = await blobToImage(fileOrBlob)
  const scale = Math.min(1, maxW / img.width)
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')

  // Draw
  ctx.drawImage(img, 0, 0, w, h)

  // Basic grayscale + contrast
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2]
    // luminance
    let y = 0.299 * r + 0.587 * g + 0.114 * b
    // simple contrast stretch
    y = (y - 128) * 1.2 + 128
    y = Math.max(0, Math.min(255, y))
    d[i] = d[i+1] = d[i+2] = y
  }
  ctx.putImageData(imgData, 0, 0)

  return c.toDataURL('image/jpeg', 0.9)
}

function blobToImage(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

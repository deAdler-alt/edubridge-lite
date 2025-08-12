import Tesseract from 'tesseract.js'

/**
 * OCR image to text using Tesseract.js
 * @param {File|Blob|string} file - image file/blob or URL
 * @param {string} lang - language code, e.g. 'eng', 'eng+pol'
 * @param {(m: {status:string, progress?:number})=>void} onProgress
 * @returns {Promise<string>}
 */
export async function ocrImage(file, lang = 'eng', onProgress) {
  const logger = typeof onProgress === 'function' ? onProgress : () => {}
  const { data } = await Tesseract.recognize(file, lang, { logger })
  return (data && data.text) ? data.text : ''
}


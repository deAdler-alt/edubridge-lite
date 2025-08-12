
export function isTtsSupported() {
  return typeof window !== 'undefined' &&
         'speechSynthesis' in window &&
         'SpeechSynthesisUtterance' in window
}

function splitIntoChunks(text, maxLen = 180) {
  const parts = (text || '').replace(/\s+/g, ' ').trim()
  if (!parts) return []
  const sentences = parts.match(/[^.!?]+[.!?]*/g) || [parts]
  const chunks = []
  let buf = ''
  for (const s of sentences) {
    const candidate = (buf ? buf + ' ' : '') + s.trim()
    if (candidate.length <= maxLen) {
      buf = candidate
    } else {
      if (buf) chunks.push(buf)
      if (s.length <= maxLen) {
        buf = s.trim()
      } else {
        // very long sentence -> hard split
        let rest = s.trim()
        while (rest.length > maxLen) {
          chunks.push(rest.slice(0, maxLen))
          rest = rest.slice(maxLen)
        }
        buf = rest
      }
    }
  }
  if (buf) chunks.push(buf)
  return chunks
}

function waitForVoices(timeout = 1500) {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    let voices = synth.getVoices()
    if (voices && voices.length) return resolve(voices)
    const id = setInterval(() => {
      voices = synth.getVoices()
      if (voices && voices.length) {
        clearInterval(id)
        resolve(voices)
      }
    }, 100)
    setTimeout(() => {
      clearInterval(id)
      resolve(synth.getVoices() || [])
    }, timeout)
  })
}

function pickVoice(langPref) {
  const voices = window.speechSynthesis.getVoices() || []
  const want = langPref === 'pl' ? 'pl' : 'en'
  // prefer exact locale, then language startsWith
  let v = voices.find(v => (v.lang || '').toLowerCase().startsWith(want + '-'))
  if (!v) v = voices.find(v => (v.lang || '').toLowerCase().startsWith(want))
  // as a final fallback, let the browser default decide
  return v || null
}

/**
 * Speak text with simple controller
 * @param {string} text
 * @param {'en'|'pl'} lang
 * @param {{ rate?: number, pitch?: number }} opts
 * @param {(e:{type:string,index?:number,total?:number,error?:any})=>void} onEvent
 * @returns {{cancel:Function,pause:Function,resume:Function,speaking:Function,paused:Function}}
 */
export async function speakText(text, lang = 'en', opts = {}, onEvent) {
  const synth = window.speechSynthesis
  const controller = {
    cancel: () => { synth.cancel(); onEvent && onEvent({ type: 'cancel' }) },
    pause:  () => { synth.pause();  onEvent && onEvent({ type: 'pause' }) },
    resume: () => { synth.resume(); onEvent && onEvent({ type: 'resume' }) },
    speaking: () => synth.speaking,
    paused:   () => synth.paused
  }
  if (!isTtsSupported()) {
    onEvent && onEvent({ type: 'unsupported' })
    return controller
  }

  const chunks = splitIntoChunks(text, 180)
  const voiceList = await waitForVoices()
  const voice = pickVoice(lang) || (voiceList[0] || null)
  const rate = opts.rate ?? 1
  const pitch = opts.pitch ?? 1
  const locale = lang === 'pl' ? 'pl-PL' : 'en-US'

  let i = 0
  onEvent && onEvent({ type: 'start', index: 0, total: chunks.length })

  function speakNext() {
    if (i >= chunks.length) {
      onEvent && onEvent({ type: 'end' })
      return
    }
    const u = new SpeechSynthesisUtterance(chunks[i])
    u.lang = locale
    if (voice) u.voice = voice
    u.rate = rate
    u.pitch = pitch
    u.onend = () => { i++; onEvent && onEvent({ type: 'chunk', index: i, total: chunks.length }); speakNext() }
    u.onerror = (e) => { i++; onEvent && onEvent({ type: 'error', error: e }); speakNext() }
    synth.speak(u)
  }

  speakNext()
  return controller
}


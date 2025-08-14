// web/src/lib/tts.js

export function isTtsSupported() {
  return typeof window !== 'undefined' &&
         'speechSynthesis' in window &&
         'SpeechSynthesisUtterance' in window
}

export function speakText(text, lang = 'en', { rate = 1, pitch = 1 } = {}, onEvent = () => {}) {
  if (!isTtsSupported()) return Promise.resolve({
    pause(){}, resume(){}, cancel(){}
  })

  const voiceLang = lang === 'pl' ? 'pl-PL' : 'en-US'
  const chunks = chunkText(text)
  let idx = 0
  let canceled = false

  const ctrl = {
    pause() { try { window.speechSynthesis.pause() } catch {} },
    resume() { try { window.speechSynthesis.resume() } catch {} },
    cancel() { canceled = true; try { window.speechSynthesis.cancel() } catch {} }
  }

  function speakNext() {
    if (canceled) { onEvent({ type: 'cancel' }); return }
    if (idx >= chunks.length) { onEvent({ type: 'end' }); return }

    const u = new SpeechSynthesisUtterance(chunks[idx])
    u.lang = voiceLang
    u.rate = rate
    u.pitch = pitch

    if (idx === 0) onEvent({ type: 'start', total: chunks.length })
    u.onstart = () => onEvent({ type: 'chunk', index: idx + 1, total: chunks.length })
    u.onend = () => { if (!canceled) { idx++; speakNext() } }
    u.onerror = () => { if (!canceled) { idx++; speakNext() } }

    try { window.speechSynthesis.speak(u) } catch { idx++; speakNext() }
  }

  speakNext()
  return Promise.resolve(ctrl)
}

function chunkText(t) {
  const sents = String(t || '').split(/(?<=[.!?])\s+/)
  const chunks = []
  let buf = ''
  for (const s of sents) {
    if ((buf + ' ' + s).length > 220) {
      if (buf) chunks.push(buf.trim())
      buf = s
    } else {
      buf = buf ? (buf + ' ' + s) : s
    }
  }
  if (buf) chunks.push(buf.trim())
  return chunks.length ? chunks : [String(t || '')]
}

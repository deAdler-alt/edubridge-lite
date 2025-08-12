import { useState, useEffect, useRef } from 'react'
import { generateLitePack } from './lib/generator'
import { exportPackToPdf } from './lib/pdf'
import { ocrImage } from './lib/ocr'
import { isTtsSupported, speakText } from './lib/tts'

const MAX_CHARS = 5000

export default function App() {
  // Core state
  const [lang, setLang] = useState('en')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pack, setPack] = useState(null)
  const [error, setError] = useState('')

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrText, setOcrText] = useState('')
  const [ocrError, setOcrError] = useState('')

  // TTS state
  const [ttsSupported, setTtsSupported] = useState(false)
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [ttsPaused, setTtsPaused] = useState(false)
  const [ttsProgress, setTtsProgress] = useState({ index: 0, total: 0 })
  const ttsRef = useRef(null)

  // PWA Install state
  const [installReady, setInstallReady] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  // Restore last session + detect TTS support + detect standalone/iOS
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('ebl_lang')
      const savedInput = localStorage.getItem('ebl_input')
      const savedPack = localStorage.getItem('ebl_pack')
      if (savedLang) setLang(savedLang)
      if (savedInput) setInput(savedInput)
      if (savedPack) setPack(JSON.parse(savedPack))
    } catch {}
    setTtsSupported(isTtsSupported())

    const ua = (navigator.userAgent || '').toLowerCase()
    const isiOSUA = /iphone|ipad|ipod/.test(ua)
    setIsIOS(isiOSUA)

    // detect if already running as installed app
    const inStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && 'standalone' in navigator && navigator.standalone)
    if (inStandalone) setInstalled(true)
  }, [])

  // Listen for PWA install events (not fired on iOS Safari)
  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
      setInstallReady(true)
    }
    function onInstalled() {
      setInstalled(true)
      setInstallReady(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function onGenerate() {
    // Stop any TTS before generating
    try { if (ttsRef.current) { ttsRef.current.cancel() } } catch {}
    setTtsPlaying(false); setTtsPaused(false); setTtsProgress({ index: 0, total: 0 })

    setError('')
    const txt = input.trim()
    if (!txt) {
      setError(lang === 'pl' ? 'Wklej tekst lub link.' : 'Please paste some text or a link.')
      return
    }
    if (txt.length < 20) {
      setError(lang === 'pl'
        ? 'Wklej trochę więcej tekstu (min. 20 znaków).'
        : 'Please paste more text (min. 20 characters).'
      )
      return
    }

    setLoading(true)
    try {
      const result = await generateLitePack(txt, lang)
      setPack(result)
      // persist
      localStorage.setItem('ebl_pack', JSON.stringify(result))
      localStorage.setItem('ebl_lang', lang)
      localStorage.setItem('ebl_input', txt)
    } catch (e) {
      setError(lang === 'pl'
        ? 'Coś poszło nie tak. Spróbuj ponownie.'
        : 'Something went wrong. Try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  function onClear() {
    // Stop any TTS before clearing
    try { if (ttsRef.current) { ttsRef.current.cancel() } } catch {}
    setTtsPlaying(false); setTtsPaused(false); setTtsProgress({ index: 0, total: 0 })

    setInput('')
    setPack(null)
    setError('')
    setOcrText('')
    setOcrError('')
    try {
      localStorage.removeItem('ebl_pack')
      localStorage.removeItem('ebl_input')
      // keep ebl_lang
    } catch {}
  }

  function onExportPdf() {
    if (!pack) return
    const firstWords = (input || '').trim().split(/\s+/).slice(0, 8).join(' ')
    const title = firstWords ? `Lite Pack – ${firstWords}…` : 'Lite Pack'
    exportPackToPdf(pack, { title, lang, appUrl: window.location.origin })
  }

  async function onImageSelected(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setOcrError('')
    setOcrText('')
    setOcrLoading(true)
    setOcrProgress(0)
    try {
      const langCode = lang === 'pl' ? 'eng+pol' : 'eng'
      const text = await ocrImage(file, langCode, (m) => {
        if (m && typeof m.progress === 'number') {
          setOcrProgress(Math.round(m.progress * 100))
        }
      })
      const clean = (text || '').trim()
      if (!clean) throw new Error('Empty OCR result')
      setOcrText(clean)
    } catch (err) {
      if (lang === 'pl') {
        try {
          const text2 = await ocrImage(e.target.files[0], 'eng', (m) => {
            if (m && typeof m.progress === 'number') {
              setOcrProgress(Math.round(m.progress * 100))
            }
          })
          const clean2 = (text2 || '').trim()
          if (!clean2) throw new Error('Empty OCR result')
          setOcrText(clean2)
        } catch {
          setOcrError(lang === 'pl'
            ? 'Błąd OCR. Spróbuj wyraźniejsze zdjęcie lub inny język.'
            : 'OCR failed. Try a clearer image or another language.'
          )
        }
      } else {
        setOcrError(lang === 'pl'
          ? 'Błąd OCR. Spróbuj wyraźniejsze zdjęcie.'
          : 'OCR failed. Try a clearer image.'
        )
      }
    } finally {
      setOcrLoading(false)
      setOcrProgress(0)
      // allow re-upload same file
      e.target.value = ''
    }
  }

  function insertOcrText() {
    if (!ocrText) return
    setInput(prev => (prev ? (prev + '\n\n' + ocrText) : ocrText))
    setOcrText('')
  }

  // NEW: Insert demo text (instant showcase)
  function insertDemoText() {
    const demo = lang === 'pl'
      ? 'Fotosynteza to proces, w którym rośliny wykorzystują energię światła do zamiany dwutlenku węgla i wody w glukozę oraz tlen. Zachodzi w chloroplastach z udziałem chlorofilu. Proces składa się z fazy jasnej i ciemnej. Ma kluczowe znaczenie dla obiegu węgla i produkcji tlenu na Ziemi.'
      : 'Photosynthesis is the process by which plants use light energy to convert carbon dioxide and water into glucose and oxygen. It occurs in chloroplasts with the help of chlorophyll. The process includes a light-dependent stage and a light-independent stage. It is essential for Earth’s carbon cycle and oxygen production.'
    setInput(demo)
    setError('')
  }

  // TTS controls
  function onTtsPlay() {
    if (!pack?.easy || !ttsSupported) return
    try { if (ttsRef.current) ttsRef.current.cancel() } catch {}
    setTtsPaused(false)
    setTtsPlaying(true)
    setTtsProgress({ index: 0, total: 0 })
    ttsRef.current = null
    speakText(pack.easy, lang, { rate: 1 }, (e) => {
      if (e.type === 'start') {
        setTtsProgress({ index: 0, total: e.total || 0 })
      } else if (e.type === 'chunk') {
        setTtsProgress({ index: e.index || 0, total: e.total || 0 })
      } else if (e.type === 'pause') {
        setTtsPaused(true)
      } else if (e.type === 'resume') {
        setTtsPaused(false)
      } else if (e.type === 'end' || e.type === 'cancel') {
        setTtsPlaying(false); setTtsPaused(false)
      }
    }).then(ctrl => { ttsRef.current = ctrl })
  }

  function onTtsPause() {
    if (!ttsRef.current) return
    ttsRef.current.pause()
    setTtsPaused(true)
  }

  function onTtsResume() {
    if (!ttsRef.current) return
    ttsRef.current.resume()
    setTtsPaused(false)
  }

  function onTtsStop() {
    if (!ttsRef.current) return
    ttsRef.current.cancel()
    setTtsPlaying(false)
    setTtsPaused(false)
    setTtsProgress({ index: 0, total: 0 })
  }

  // PWA: show install prompt (Android/desktop)
  async function onInstallClick() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    try { await deferredPrompt.userChoice } catch {}
    setDeferredPrompt(null)
    setInstallReady(false)
  }

  const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0
  const charCount = input.length
  const overLimit = charCount > MAX_CHARS

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>EduBridge Lite <span className="badge">MVP</span></h1>
          <div>
            <label className="muted" style={{ marginRight: 8 }}>
              {lang === 'pl' ? 'Język' : 'Language'}
            </label>
            <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
              <option value="en">EN</option>
              <option value="pl">PL</option>
            </select>
          </div>
        </div>

        <p className="muted">
          {lang === 'pl'
            ? 'Wklej tekst lekcji lub link do artykułu. Albo zrób zdjęcie notatki i użyj OCR. Utworzymy Lite Pack: podsumowanie, wersję prostym językiem, fiszki i quiz.'
            : 'Paste lesson text or an article link. Or take a photo of notes and use OCR. We will create a Lite Pack: summary, easy language version, flashcards, and a quiz.'}
        </p>

        {/* Quick win: Insert demo text */}
        <div className="row" style={{ marginTop: 4 }}>
          <button onClick={insertDemoText}>
            {lang === 'pl' ? 'Wstaw przykładowy tekst' : 'Insert demo text'}
          </button>
          <span className="muted">{lang === 'pl'
            ? 'Jeden klik, by zobaczyć wynik.'
            : 'One click to see it in action.'}</span>
        </div>

        {/* A2HS / Install app */}
        {installReady && !isIOS && (
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={onInstallClick}>
              {lang === 'pl' ? 'Zainstaluj aplikację' : 'Install app'}
            </button>
            <span className="muted">
              {lang === 'pl'
                ? 'Dodaj do ekranu głównego, aby działać jak natywna aplikacja.'
                : 'Add to Home Screen to use it like a native app.'}
            </span>
          </div>
        )}
        {!installReady && !installed && isIOS && (
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted">
              {lang === 'pl'
                ? 'Na iOS: Udostępnij → „Dodaj do ekranu początkowego”.'
                : 'On iOS: Share → “Add to Home Screen”.'}
            </span>
          </div>
        )}
        {installed && (
          <div className="muted" style={{ marginTop: 6 }}>
            {lang === 'pl' ? 'Aplikacja zainstalowana ✅' : 'App installed ✅'}
          </div>
        )}

        {/* OCR Upload Row */}
        <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onImageSelected}
            aria-label="Upload image for OCR"
          />
          <button onClick={insertOcrText} disabled={!ocrText || ocrLoading}>
            {lang === 'pl' ? 'Wstaw tekst z OCR' : 'Insert OCR text'}
          </button>
          {ocrLoading && (
            <span className="muted" aria-live="polite">OCR: {ocrProgress}%</span>
          )}
        </div>

        {ocrError && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              background: '#361a1a',
              border: '1px solid #663',
              padding: 10,
              borderRadius: 8,
              margin: '8px 0'
            }}
          >
            {ocrError}
          </div>
        )}

        {ocrText && (
          <details style={{ marginBottom: 8 }}>
            <summary className="muted">{lang === 'pl' ? 'Podgląd OCR' : 'OCR preview'}</summary>
            <textarea
              readOnly
              value={ocrText}
              rows={6}
              style={{ width: '100%', marginTop: 8 }}
              aria-label="OCR preview"
            />
          </details>
        )}

        <textarea
          placeholder={lang === 'pl' ? 'Wklej tekst lub link…' : 'Paste text or link here…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Source text"
          maxLength={MAX_CHARS}
        />

        <p className="muted" style={{ marginTop: 6 }}>
          {wordCount} {lang === 'pl' ? 'słów' : 'words'} — {charCount}/{MAX_CHARS} {lang === 'pl' ? 'znaków' : 'chars'}
          {overLimit && <b> {lang === 'pl' ? '(przekroczono limit)' : '(over limit)'}</b>}
        </p>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              background: '#361a1a',
              border: '1px solid #663',
              padding: 10,
              borderRadius: 8,
              marginTop: 8
            }}
          >
            {error}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={onGenerate} disabled={loading || input.trim().length < 20}>
            {loading
              ? (lang === 'pl' ? 'Generowanie…' : 'Generating…')
              : (lang === 'pl' ? 'Utwórz Lite Pack' : 'Generate Lite Pack')}
          </button>
          <button onClick={onClear} disabled={loading}>
            {lang === 'pl' ? 'Wyczyść' : 'Clear'}
          </button>
          <button onClick={onExportPdf} disabled={!pack || loading}>
            Export PDF
          </button>
        </div>

        {/* TTS controls */}
        {pack && (
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={onTtsPlay} disabled={!ttsSupported || ttsPlaying}>
              {lang === 'pl' ? 'Odtwórz Easy' : 'Play Easy'}
            </button>
            <button onClick={onTtsPause} disabled={!ttsSupported || !ttsPlaying || ttsPaused}>
              {lang === 'pl' ? 'Pauza' : 'Pause'}
            </button>
            <button onClick={onTtsResume} disabled={!ttsSupported || !ttsPaused}>
              {lang === 'pl' ? 'Wznów' : 'Resume'}
            </button>
            <button onClick={onTtsStop} disabled={!ttsSupported || (!ttsPlaying && !ttsPaused)}>
              {lang === 'pl' ? 'Stop' : 'Stop'}
            </button>
            {!ttsSupported && (
              <span className="muted">
                {lang === 'pl' ? 'TTS nieobsługiwany w tej przeglądarce.' : 'TTS not supported in this browser.'}
              </span>
            )}
            {(ttsPlaying || ttsPaused) && (
              <span className="muted" aria-live="polite">
                {lang === 'pl'
                  ? `Postęp: ${ttsProgress.index}/${ttsProgress.total}`
                  : `Progress: ${ttsProgress.index}/${ttsProgress.total}`}
              </span>
            )}
          </div>
        )}

        {pack && (
          <>
            <hr />
            <section className="section">
              <h2>Summary</h2>
              <ul>{pack.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>

            <section className="section">
              <h2>{lang === 'pl' ? 'Wersja łatwiejsza' : 'Easy Language'}</h2>
              <p>{pack.easy}</p>
            </section>

            <section className="section">
              <h2>Flashcards</h2>
              <ul>
                {pack.flashcards.map((f, i) => (
                  <li key={i}>
                    <b>Q:</b> {f.q} — <b>A:</b> {f.a}
                  </li>
                ))}
              </ul>
            </section>

            <section className="section">
              <h2>Quiz</h2>
              <ol>
                {pack.quiz.map((q, i) => (
                  <li key={i}>
                    {q.q} <span className="muted">(A/B/C/D)</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <p className="footer">© EduBridge Lite – offline-first education helper</p>
      </div>
    </div>
  )
}

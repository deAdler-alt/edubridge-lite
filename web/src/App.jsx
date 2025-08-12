import { useState, useEffect } from 'react'
import { generateLitePack } from './lib/generator'
import { exportPackToPdf } from './lib/pdf'

export default function App() {
  const [lang, setLang] = useState('en')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pack, setPack] = useState(null)
  const [error, setError] = useState('')

  // Restore last session
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('ebl_lang')
      const savedInput = localStorage.getItem('ebl_input')
      const savedPack = localStorage.getItem('ebl_pack')
      if (savedLang) setLang(savedLang)
      if (savedInput) setInput(savedInput)
      if (savedPack) setPack(JSON.parse(savedPack))
    } catch {}
  }, [])

  async function onGenerate() {
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
    setInput('')
    setPack(null)
    setError('')
    try {
      localStorage.removeItem('ebl_pack')
      localStorage.removeItem('ebl_input')
      // pozostawiamy ebl_lang, żeby język się nie resetował
    } catch {}
  }

  function onExportPdf() {
    if (!pack) return
    const firstWords = (input || '').trim().split(/\s+/).slice(0, 8).join(' ')
    const title = firstWords ? `Lite Pack – ${firstWords}…` : 'Lite Pack'
    exportPackToPdf(pack, { title, lang })
  }

  const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0

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
            ? 'Wklej tekst lekcji lub link do artykułu. Utworzymy Lite Pack: podsumowanie, wersję prostym językiem, fiszki i quiz.'
            : 'Paste lesson text or an article link. We will create a Lite Pack: summary, easy language version, flashcards, and a quiz.'}
        </p>

        <textarea
          placeholder={lang === 'pl' ? 'Wklej tekst lub link…' : 'Paste text or link here…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Source text"
        />

        <p className="muted" style={{ marginTop: 6 }}>{wordCount} {lang === 'pl' ? 'słów' : 'words'}</p>

        {error && (
          <div
            role="alert"
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
                {pack.flashcards.map((f, i) =>
                  <li key={i}><b>Q:</b> {f.q} — <b>A:</b> {f.a}</li>
                )}
              </ul>
            </section>

            <section className="section">
              <h2>Quiz</h2>
              <ol>
                {pack.quiz.map((q, i) =>
                  <li key={i}>{q.q} <span className="muted">(A/B/C/D)</span></li>
                )}
              </ol>
            </section>
          </>
        )}

        <p className="footer">© EduBridge Lite – offline-first education helper</p>
      </div>
    </div>
  )
}

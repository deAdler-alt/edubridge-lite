import { useState } from 'react'
import { generateLitePack } from './lib/generator'

export default function App() {
  const [lang, setLang] = useState('en')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pack, setPack] = useState(null)
  const [error, setError] = useState('')

  async function onGenerate() {
    setError('')
    if (!input.trim()) { setError('Please paste some text or a link.'); return }
    setLoading(true)
    try {
      const result = await generateLitePack(input, lang)
      setPack(result)
    } catch (e) {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function onClear() {
    setInput('')
    setPack(null)
    setError('')
  }

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
          <h1>EduBridge Lite <span className="badge">MVP</span></h1>
          <div>
            <label className="muted" style={{marginRight:8}}>Language</label>
            <select value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="pl">PL</option>
            </select>
          </div>
        </div>
        <p className="muted">Paste any lesson text or article URL. We’ll create a Lite Pack: summary, easy version, flashcards and a quiz.</p>

        <textarea
          placeholder="Paste text or a link here…"
          value={input}
          onChange={e=>setInput(e.target.value)}
        />

        {error && <p style={{color:'#ff7b7b'}}>{error}</p>}

        <div className="row" style={{marginTop:12}}>
          <button onClick={onGenerate} disabled={loading || !input.trim()}>
            {loading ? 'Generating…' : 'Generate Lite Pack'}
          </button>
          <button onClick={onClear}>Clear</button>
        </div>

        {pack && (
          <>
            <hr />
            <section className="section">
              <h2>Summary</h2>
              <ul>{pack.summary.map((s,i)=><li key={i}>{s}</li>)}</ul>
            </section>

            <section className="section">
              <h2>{lang==='pl' ? 'Wersja łatwiejsza' : 'Easy Language'}</h2>
              <p>{pack.easy}</p>
            </section>

            <section className="section">
              <h2>Flashcards</h2>
              <ul>{pack.flashcards.map((f,i)=><li key={i}><b>Q:</b> {f.q} — <b>A:</b> {f.a}</li>)}</ul>
            </section>

            <section className="section">
              <h2>Quiz</h2>
              <ol>{pack.quiz.map((q,i)=><li key={i}>{q.q} <span className="muted">(A/B/C/D)</span></li>)}</ol>
            </section>
          </>
        )}

        <p className="footer">© EduBridge Lite – offline-first education helper</p>
      </div>
    </div>
  )
}

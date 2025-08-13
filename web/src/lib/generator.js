const MAX_SUMMARY = 5
const MAX_FLASH = 8
const MAX_QUIZ = 6

const STOPWORDS_EN = new Set([
  'the','and','or','for','with','that','this','from','into','onto','over','under',
  'is','are','was','were','be','been','being','to','of','in','on','by','as','at',
  'it','its','an','a','than','then','but','so','if','about','which','who','whom',
  'their','there','these','those','we','you','they','i','he','she','them','our','your'
])
const STOPWORDS_PL = new Set([
  'i','oraz','lub','albo','że','to','jest','są','być','było','była','były','byli',
  'z','na','do','od','po','w','we','o','u','za','przez','dla','jak','który','która',
  'które','których','ten','ta','te','to','tam','tu','tego','tej','ich','nasz','wasz'
])

export async function generateLitePack(raw, lang = 'en') {
  const text = normalize(raw)
  const sentences = splitSentences(text)

  // Summary: 1 zdanie = 1 punkt (do 5)
  const summary = sentences.slice(0, MAX_SUMMARY).map(s => trimLen(s, 220))

  // Easy language (prosta parafraza bez LLM: krótsze zdania)
  const easy = toEasyLanguage(sentences, lang)

  // Flashcards: cloze – wybieramy słowa-klucze i maskujemy w zdaniach
  const keywords = pickKeywords(text, lang, 12)
  const flashcards = makeClozeFlashcards(sentences, keywords, MAX_FLASH)

  // Quiz: „Jaki termin najlepiej uzupełnia zdanie” + dystraktory
  const quiz = makeQuiz(sentences, keywords, MAX_QUIZ)

  return { summary, easy, flashcards, quiz }
}

// --- helpers ---

function normalize(t) {
  return String(t || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim()
}

function splitSentences(t) {
  if (!t) return []
  // proste cięcie po kropce/!/?, zachowuje skróty typu e.g. ograniczając liczby pojedynczych liter
  return t.split(/(?<=[.!?])\s+(?=[A-ZŁŚŻŹĆŃ0-9])/).map(s => s.trim()).filter(Boolean)
}

function trimLen(s, n) {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trim() + '…'
}

function toEasyLanguage(sentences, lang) {
  const max = Math.min(5, Math.max(2, sentences.length))
  const simple = sentences.slice(0, max).map(s =>
    s
      .replace(/\((.*?)\)/g, '')               // bez nawiasów
      .replace(/[,;:]/g, ',')                  // uproszczona interpunkcja
      .replace(/\bwhich\b/gi, 'that')          // drobne uproszczenia EN
      .replace(/\bthus\b/gi, 'so')
      .replace(/\btherefore\b/gi, 'so')
      .trim()
  )
  return simple.join(' ')
}

function pickKeywords(text, lang, limit = 12) {
  const stop = lang === 'pl' ? STOPWORDS_PL : STOPWORDS_EN
  const freq = new Map()
  const words = text.toLowerCase().match(/[a-ząćęłńóśżź\-]+/gi) || []
  for (const w of words) {
    if (w.length < 5) continue
    if (stop.has(w)) continue
    freq.set(w, (freq.get(w) || 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([w]) => w)
}

function sentenceContaining(sentences, term) {
  const re = new RegExp(`\\b${escapeReg(term)}\\b`, 'i')
  return sentences.find(s => re.test(s)) || ''
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clozeSentence(s, term) {
  const re = new RegExp(`\\b${escapeReg(term)}\\b`, 'gi')
  const blanked = s.replace(re, '____')
  return trimLen(blanked, 200)
}

function makeClozeFlashcards(sentences, keywords, maxN) {
  const out = []
  const used = new Set()
  for (const term of keywords) {
    const s = sentenceContaining(sentences, term)
    if (!s) continue
    if (used.has(s)) continue
    used.add(s)
    out.push({ q: `Fill in the blank: ${clozeSentence(s, term)}`, a: term })
    if (out.length >= maxN) break
  }
  return out.length ? out : [{ q: 'What is the main idea?', a: 'See summary.' }]
}

function makeQuiz(sentences, keywords, maxN) {
  const baseDistr = ['energy','process','system','water','oxygen','carbon','cycle','stage']
  const pool = Array.from(new Set([...keywords, ...baseDistr]))
  const out = []
  const used = new Set()

  for (const term of keywords) {
    const s = sentenceContaining(sentences, term)
    if (!s) continue
    if (used.has(s)) continue
    used.add(s)

    // Zbuduj opcje: poprawna + 3 losowe z puli ≠ term
    const distractors = pool.filter(x => x !== term).slice(0).sort(() => Math.random() - 0.5).slice(0, 3)
    const opts = shuffle([term, ...distractors])
    const letters = ['A', 'B', 'C', 'D']
    const optsText = opts.map((o, i) => `${letters[i]}) ${o}`).join('  ')
    const q = `Which term best completes the sentence: “${clozeSentence(s, term)}”?  ${optsText}`
    out.push({ q, answer: letters[opts.indexOf(term)], options: opts })
    if (out.length >= maxN) break
  }

  return out
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

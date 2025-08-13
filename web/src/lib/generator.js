// web/src/lib/generator.js
// Heurystyczny generator offline bez LLM:
// - Key Points (summary): wybór najlepszych zdań wg punktacji (pozycja, keywords, długość) + deduplikacja Jaccard
// - Easy language: skrócone, proste zdania
// - Flashcards: cloze (wstawka ____)
// - Quiz: MCQ z dystraktorami

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

  // keywords: trochę więcej (pomaga scoringowi)
  const keywords = pickKeywords(text, lang, 16)

  // Key Points (summary): wybór na podstawie scoringu + deduplikacji
  const summary = selectKeyPoints(sentences, keywords, lang, MAX_SUMMARY)

  // Easy language – prosta parafraza bez LLM
  const easy = toEasyLanguage(sentences, lang)

  // Flashcards – cloze na bazie keywords
  const flashcards = makeClozeFlashcards(sentences, keywords, MAX_FLASH)

  // Quiz – MCQ z dystraktorami
  const quiz = makeQuiz(sentences, keywords, MAX_QUIZ)

  return { summary, easy, flashcards, quiz }
}

// ---------------- helpers ----------------

function normalize(t) {
  return String(t || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSentences(t) {
  if (!t) return []
  // proste cięcie po końcu zdania; zakładamy wielką literę/ cyfrę po spacji
  return t
    .split(/(?<=[.!?])\s+(?=[A-ZŁŚŻŹĆŃ0-9])/)
    .map(s => s.trim())
    .filter(Boolean)
}

function trimLen(s, n) {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trim() + '…'
}

function toEasyLanguage(sentences, lang) {
  const max = Math.min(5, Math.max(2, sentences.length))
  const simple = sentences.slice(0, max).map(s =>
    s
      .replace(/\((.*?)\)/g, '')
      .replace(/[;:—–]/g, ',') 
      .replace(/\s*,\s*,/g, ',')
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

// -------- Key Points selection ----------

function selectKeyPoints(sentences, keywords, lang, maxN) {
  if (!sentences.length) return []

  // policz score dla każdego zdania
  const scored = sentences.map((s, i) => ({
    i,
    s,
    score: scoreSentence(s, i, keywords, lang)
  }))

  // sort malejąco po score, stabilnie po pozycji
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i))

  // deduplikacja po podobieństwie (Jaccard na tokenach bez stopwords)
  const out = []
  for (const cand of scored) {
    const bullet = condenseBullet(cand.s)
    const candTokens = tokenSet(bullet, lang)
    let tooSimilar = false
    for (const chosen of out) {
      const sim = jaccard(candTokens, tokenSet(chosen, lang))
      if (sim >= 0.6) { // dość podobne — pomijamy
        tooSimilar = true
        break
      }
    }
    if (!tooSimilar) out.push(bullet)
    if (out.length >= maxN) break
  }

  // fallback: w razie czego weź początkowe zdania
  if (!out.length) {
    return sentences.slice(0, maxN).map(condenseBullet)
  }
  return out
}

function scoreSentence(s, index, keywords, lang) {
  let score = 0

  // 1) Pozycja w tekście (lead bias)
  if (index === 0) score += 3
  else if (index === 1) score += 2
  else if (index === 2) score += 1.2
  else score += Math.max(0, 1.0 - index * 0.03) // lekka degradacja dalej w tekście

  // 2) Trafienia keywordów (unikalne)
  const lower = s.toLowerCase()
  let hits = 0
  const seen = new Set()
  for (const k of keywords) {
    if (seen.has(k)) continue
    if (new RegExp(`\\b${escapeReg(k)}\\b`, 'i').test(lower)) {
      seen.add(k)
      hits += 1
    }
  }
  score += hits * 1.5

  // 3) Długość: preferujemy ~60–180 znaków
  const len = s.length
  if (len > 220) score -= Math.min(2, (len - 220) / 100) // kara za tasiemce
  if (len >= 60 && len <= 180) score += 0.8
  if (len < 40) score -= 0.4

  // 4) Proste heurystyki semantyczne
  const boostersEN = /\b(is|are|includes|consists|helps|allows|enables|defines)\b/i
  const boostersPL = /\b(jest|to|składa się|zawiera|umożliwia|pozwala|definiuje)\b/i
  if ((lang === 'pl' ? boostersPL : boostersEN).test(lower)) score += 0.3

  return score
}

function condenseBullet(s) {
  let t = s
    .replace(/\s+/g, ' ')
    .replace(/\((.*?)\)/g, '')
    .replace(/\s*[,;:—–]\s*/g, ', ')
    .replace(/\s*,\s*,/g, ', ')
    .trim()
  t = t.replace(/,\s*\./g, '.')
  const cut = t.split(/(?<=,|\.)\s/)[0] || t
  t = cut.length >= 80 ? (cut.slice(0, 179).trim() + '…') : cut
  if (!/[.!?…]$/.test(t)) t += '.'
  t = t.charAt(0).toUpperCase() + t.slice(1)
  return t
}


function tokenSet(s, lang) {
  const stop = lang === 'pl' ? STOPWORDS_PL : STOPWORDS_EN
  const words = (s.toLowerCase().match(/[a-ząćęłńóśżź]+/gi) || [])
    .filter(w => !stop.has(w) && w.length >= 4)
  return new Set(words)
}

function jaccard(aSet, bSet) {
  if (!aSet.size && !bSet.size) return 1
  let inter = 0
  for (const x of aSet) if (bSet.has(x)) inter++
  const uni = aSet.size + bSet.size - inter
  return uni ? inter / uni : 0
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// -------- Flashcards / Quiz ----------

function sentenceContaining(sentences, term) {
  const re = new RegExp(`\\b${escapeReg(term)}\\b`, 'i')
  return sentences.find(s => re.test(s)) || ''
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
  const letters = ['A', 'B', 'C', 'D']

  for (const term of keywords) {
    const s = sentenceContaining(sentences, term)
    if (!s) continue
    if (used.has(s)) continue
    used.add(s)

    const distractors = pool.filter(x => x !== term).slice(0).sort(() => Math.random() - 0.5).slice(0, 3)
    const opts = shuffle([term, ...distractors])
    const q = `Which term best completes the sentence: “${clozeSentence(s, term)}”?`
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

export async function generateLitePack(input, lang = 'en') {
  const clean = String(input || '').trim().replace(/\s+/g, ' ')
  const words = clean.split(' ').filter(Boolean)
  const sumLen = Math.min(10, Math.max(5, Math.floor(words.length / 25)))

  const summary = Array.from({ length: sumLen }).map((_, i) => {
    const start = i * 12
    return `Key point ${i + 1}: ` + words.slice(start, start + 12).join(' ')
  })

  const easy = (lang === 'pl'
    ? 'Wersja prostym językiem (B1): '
    : 'Easy language version (B1): '
  ) + clean.slice(0, 500)

  const flashcards = Array.from({ length: 8 }).map((_, i) => ({
    q: lang === 'pl' ? `Pytanie ${i + 1}` : `Question ${i + 1}`,
    a: lang === 'pl' ? `Odpowiedź ${i + 1}` : `Answer ${i + 1}`,
  }))

  const quiz = Array.from({ length: 6 }).map((_, i) => ({
    q: lang === 'pl' ? `Pytanie testowe ${i + 1}?` : `Quiz question ${i + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
  }))

  return { summary, easy, flashcards, quiz, lang }
}

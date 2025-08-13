```md
# Architecture

## Overview
- **React + Vite PWA**, service worker caches static assets.
- **IndexedDB** for saved packs.
- **Heuristics** in `lib/generator.js`:
  - sentence scoring (position, keyword hits, length window, semantic boosters),
  - Jaccard dedup,
  - cloze flashcards,
  - MCQ quiz with distractors.
- **OCR** `lib/ocr.js`: resize → grayscale/contrast → Tesseract.js.
- **TTS** `lib/tts.js`: chunking per sentence, reliable STOP (cancel queue).
- **PDF** `lib/pdf.js`: safe page breaks + reserved footer area with QR.
- **/api/extract**: HTML fetch + node-html-parser; tolerant fallbacks.
- **/api/telegram**: webhook (optional), multi-message replies.

## Data
- No server DB. Packs saved as `{id,title,lang,input,pack,createdAt}` in IndexedDB.

## Limits
- Input capped at 5000 chars (UX + Telegram limits).
- Extractor may fail on hard paywalls/JS-only sites (graceful errors).
```
# EduBridge Lite — Devpost Submission

## Inspiration
In many classrooms and homes, bandwidth and budget are limited. EduBridge Lite compresses any lesson — text, photo, or link — into an offline-friendly study pack, letting students revise anywhere.

## What it does
- Import **text/URL/photo** → generate **Key Points**, **Easy Language**, **Flashcards**, **Quiz**.
- **Save offline** (IndexedDB), **TTS** to listen, **PDF** export, **PWA** install.

## How we built it
- **React + Vite PWA** with service worker.
- **Heuristics (no paid LLMs)**: sentence scoring (keywords+position+length) for Key Points, cloze flashcards, MCQ quiz.
- **OCR** via Tesseract.js with light pre-processing.
- **Serverless (Vercel)**: `/api/extract` to fetch+parse articles.
- **IndexedDB** for local library; **jsPDF+qrcode** for export.

## Challenges we ran into
- Getting OCR readable on low-quality images — solved with client-side grayscale/contrast pre-processing.
- TTS **Stop** reliability on Safari — fixed by canceling queue aggressively.
- Article extraction against dynamic sites — added fallbacks and friendly errors.

## Accomplishments that we're proud of
- Fully **offline-first** experience without paid APIs.
- Useful **Key Points** via robust heuristics (no “Key point 1/2…” placeholders).
- Clean PDFs with QR back to app.

## What we learned
- PWA nuances on iOS, text-chunking for TTS, and practical article extraction heuristics.

## What's next
- Telegram integration (secret_token, rate limits) as future work.
- More importers (PDF/docx).
- Community templates for subjects.

## Links
- **Live app:** https://edubridge-lite-evx10ngss-deadler-alts-projects.vercel.app 
- **Repo:** https://github.com/deAdler-alt/edubridge-lite.git 
- **Demo video (≤5 min):** <YouTube>
- **Slides:** <canva link>
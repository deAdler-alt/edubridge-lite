# EduBridge Lite — Devpost Copy

## Inspiration
We wanted an ultra-light, offline-first tool that helps teachers and students in under-resourced communities quickly turn any text or photo of notes into accessible “Lite Packs” — summary, easy-language version, flashcards, and a mini-quiz.

## What it does
- Paste text or upload a photo (OCR).
- Generates a Lite Pack (summary bullets, easy-language, flashcards, quiz).
- Exports to PDF.
- Text-to-Speech (TTS) to listen to the easy-language version.
- PWA: works offline and can be installed on phones.

## How we built it
- Frontend: React + Vite (JavaScript)
- OCR: Tesseract.js (client-side)
- TTS: Web Speech API
- PDF export: jsPDF
- PWA: vite-plugin-pwa + Service Worker (offline)
- Hosting: Vercel

## Challenges we ran into
- Reliable OCR on mobile photos (lighting, blur).
- iOS limitations (no `beforeinstallprompt`), so we added a visible A2HS hint.
- Keeping the UX simple for first-time users.

## Accomplishments that we're proud of
- Fully offline-capable web app with installable PWA.
- One-click PDF export and functional OCR pipeline.
- Beginner-friendly, open-source repo and clear docs.

## What we learned
- How to structure a hackathon MVP into tiny milestones.
- PWA quirks on iOS vs Android.
- Designing for accessibility-first outputs (easy-language, TTS).

## What’s next
- Real LLM-based summaries and quiz generation (with a free-tier fallback).
- Community-contributed Lite Pack templates and translations.
- Simple backend sync for classrooms + Telegram bot (prototype included).

## Link(s)
- Live Demo: <YOUR_VERCEL_URL>
- GitHub Repo: https://github.com/<your-user>/edubridge-lite

## License
MIT

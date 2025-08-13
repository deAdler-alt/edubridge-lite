````md
# EduBridge Lite (PWA) — Offline-first learning helper

**Mission:** Make education more accessible for under-resourced communities and high-schoolers by compressing any lesson (text/photo/link) into *Key Points*, *Easy Language*, *Flashcards* and a *Quiz* — all running on **free, offline, and open** tech.

**Live:** <your Vercel URL> • **Telegram bot:** see `TELEGRAM.md`  
**Languages:** EN + PL

---

## Features
- ✂️ **Import**: paste text **or** URL (serverless extractor), or use **OCR** from a photo.
- 🧠 **Key Points**: top 5 bullets (scored by keywords+position+length, dedupped).
- 😀 **Easy Language**: simplified version for quick understanding.
- 🃏 **Flashcards**: cloze questions from key terms.
- ❓ **Quiz**: MCQ (A/B/C/D) with distractors.
- 💾 **My Packs**: local library (IndexedDB), save/load/delete, works **offline**.
- 🗣️ **TTS**: play/pause/resume/stop, reads Easy Language aloud.
- 📄 **PDF Export**: clean multi-page with QR back to app.
- 📱 **PWA**: installable, offline-first. iOS & Android friendly.

---

## Quick start (local)
```bash
git clone <repo>
cd web
npm i
npm run dev
````

Open [http://localhost:5173](http://localhost:5173)

Build & preview:

```bash
npm run build
npm run preview
```

Deploy to Vercel: add project with root at repo, build command `npm run build`, output `web/dist`.

---

## Tech

* **React + Vite** (frontend, PWA)
* **IndexedDB** via simple wrappers (local packs)
* **Tesseract.js** (OCR with light pre-processing)
* **Web Speech Synthesis** (TTS)
* **jsPDF + qrcode** (PDF export)
* **Serverless (Vercel)**: `/api/extract` (URL → text), `/api/telegram` (webhook)

---

## Project structure

```
web/
  src/
    App.jsx         # UI
    lib/
      generator.js  # heuristics: key points, flashcards, quiz
      ocr.js        # image → text (preproc + Tesseract)
      tts.js        # speech synthesis helper
      pdf.js        # PDF export + QR
      extract.js    # call /api/extract
      store.js      # IndexedDB wrapper
  api/
    extract.js      # URL extractor (serverless)
    telegram.js     # Telegram webhook (optional)
  public/           # icons + manifest
docs/
  ARCHITECTURE.md
  demo-script.md
```

---

## Privacy

* No accounts. No analytics. No server DB.
* Everything runs in your browser. Serverless is only used to fetch article HTML and to reply in Telegram. See `PRIVACY.md`.

---

## License

MIT — see `LICENSE`.

````
# 🇮🇳 HindiVoice Translator

A browser-based AI/ML web app that translates English text and voice input into Hindi, then speaks the Hindi result aloud.

## ✨ Features

- ⌨️ English text → Hindi translation
- 🎙️ English voice → speech recognition → Hindi translation
- 🔊 Hindi text-to-speech playback
- 🧠 Neural machine translation running in the browser
- ⚡ WebGPU acceleration when available, with CPU fallback
- 📱 Responsive desktop/mobile UI
- 💾 Browser-side model caching after the first download

## 🧠 ML pipeline

`English text → Marian neural machine translation → Hindi text`

For voice:

`Microphone → Web Speech API → English text → Marian translation → Hindi text → Browser speech synthesis`

The translation model is **Xenova/opus-mt-en-hi**, used through **Hugging Face Transformers.js** and ONNX Runtime. Transformers.js supports browser-side inference and WebGPU acceleration, so this project does not need a Python ML server for its core translation inference.

## 🛠️ Tech stack

- Vite
- JavaScript
- Hugging Face Transformers.js
- Xenova/opus-mt-en-hi
- ONNX Runtime
- Web Speech API
- Browser Speech Synthesis

## ▶️ Run locally

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

For a production build:

```bash
npm run build
npm run preview
```

## 🌐 Deployment

This repository is ready for Vercel because it is a static Vite app. The ML model is fetched from the Hugging Face Hub at runtime and then cached in the browser.

> The first translation on a new browser can take longer because the model files need to download. Later translations are faster because the browser cache is reused.

## 🎓 College project talking points

This project demonstrates:

1. Neural machine translation.
2. Running ML inference inside a web browser.
3. GPU/CPU inference selection.
4. Speech recognition and text-to-speech integration.
5. A complete ML-to-UI application pipeline.

## 📄 License

For academic/educational use.

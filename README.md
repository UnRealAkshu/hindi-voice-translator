# 🇮🇳 HindiVoice Translator

AI-powered web app that translates text and voice input into Hindi using machine learning, speech recognition and text-to-speech.

## Features
- Text → Hindi translation
- Voice → speech recognition → Hindi translation
- Hindi text → speech
- Responsive browser UI
- NLLB-200 neural translation model

## Stack
Flask • Hugging Face Transformers • PyTorch • NLLB-200 • SpeechRecognition • gTTS • HTML/CSS/JavaScript

## Run locally
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

The first translation request downloads the NLLB-200 model. Voice input uses the browser microphone and speech recognition.

## Pipeline
Text: user text → NLLB-200 → Hindi text

Voice: microphone → speech recognition → NLLB-200 → Hindi text → gTTS → Hindi audio

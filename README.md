# 🇮🇳 HindiVoice Translator

A beginner-friendly **BTech CSE / AIML** web application that translates English text or speech into Hindi and can speak the Hindi result back.

## ✨ Features

- ⌨️ English text → Hindi text
- 🎙️ English voice → local Whisper speech-to-text
- 🧠 Neural English → Hindi translation
- 🔊 Hindi text-to-speech
- 🔁 Live interpreter mode: listen → translate → speak Hindi → listen again
- 🌐 Flask web interface
- 💻 Works locally on a normal student laptop

## 🧠 ML pipeline

Text:

`English text → Flask → Helsinki-NLP neural translation model → Hindi text`

Voice:

`Microphone → MediaRecorder → local faster-whisper → English text → neural translation → Hindi speech`

The voice recognizer no longer depends on the browser's Web Speech Recognition service. This avoids the common browser `network` interruption problem.

## 🛠️ Tech stack

- Python
- Flask
- Hugging Face Transformers
- PyTorch
- Helsinki-NLP `opus-mt-en-hi`
- faster-whisper / CTranslate2
- HTML / CSS / JavaScript
- Browser Speech Synthesis

## 📁 Project structure

```text
hindi-voice-translator/
│
├── app.py
├── translator.py
├── voice.py
├── requirements.txt
│
├── templates/
│   └── index.html
│
├── static/
│   ├── style.css
│   └── script.js
│
└── STUDENT_GUIDE.md
```

## ▶️ Run locally

### 1. Create and activate the virtual environment

Windows PowerShell:

```powershell
py -m venv .venv
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.venv\Scripts\activate
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

The first voice use downloads the small Whisper model and the first text translation downloads the neural translation model. Models are then cached locally.

### 3. Start Flask

```powershell
python app.py
```

Open:

`http://127.0.0.1:5000`

## ⚡ Voice mode

Click **Start Live** and speak one sentence naturally.

The browser records a short turn, automatically detects the pause, sends the recording to the local Whisper model, translates the English text using the Flask/PyTorch model, and speaks the Hindi result. After the Hindi speech finishes, the microphone starts listening for the next turn.

## 🎓 Viva explanation

**Where is Machine Learning used?**

Two pretrained neural models are integrated:

1. **faster-whisper** for speech-to-text.
2. **Helsinki-NLP opus-mt-en-hi** for English-to-Hindi translation.

**Why Python?**

Python makes it easy to combine Flask, PyTorch and Hugging Face models in one project.

**What does Flask do?**

Flask is the backend server. It provides:

- `POST /api/translate` for text translation.
- `POST /api/transcribe` for local Whisper speech recognition.
- `GET /api/health` for a simple health check.

**Is the model trained from scratch?**

No. We use pretrained models and focus on application integration, the end-to-end pipeline, live turn handling and user interface.

## 📚 Student learning order

1. Read `app.py` to understand Flask routes.
2. Read `translator.py` to understand the translation model.
3. Read `voice.py` to understand speech recognition.
4. Read `static/script.js` to understand browser recording and API calls.
5. Read `templates/index.html` and `static/style.css` for the UI.

See **STUDENT_GUIDE.md** for viva questions and a simple architecture explanation.

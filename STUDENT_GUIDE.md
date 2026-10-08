# 🎓 Student Guide — HindiVoice Translator

This guide is for a 3rd-year BTech CSE/AIML student with basic Python, C and Java.

## Run the Python version

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open:

`http://127.0.0.1:5000`

## Learn the code in this order

### 1. app.py
Flask creates the web server.

Important route:

`POST /api/translate`

It receives:

```json
{"text":"Where are you going?"}
```

and returns:

```json
{"hindi":"तुम कहाँ जा रहे हो?"}
```

### 2. translator.py
This is the ML part.

The pretrained model:

`Helsinki-NLP/opus-mt-en-hi`

takes English text and produces Hindi text.

The function you should understand first is:

`translate_to_hindi(text)`

### 3. templates/index.html
Creates the webpage.

### 4. static/style.css
Controls the design.

### 5. static/script.js
Connects the webpage to Flask and handles:
- translate button
- microphone input
- live mode
- Hindi speech
- copy/clear buttons

## Simple architecture

```text
User
  ↓
HTML / CSS / JavaScript
  ↓
Flask API
  ↓
Hugging Face Transformer
  ↓
Hindi text
  ↓
Browser Hindi speech
```

## Viva one-liner

> “We built a Flask-based web application that integrates a pretrained neural machine translation model to convert English speech/text into Hindi, with browser speech recognition and text-to-speech for a live interpreter experience.”


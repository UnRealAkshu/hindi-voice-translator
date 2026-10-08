from flask import Flask, request, jsonify, render_template
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
import speech_recognition as sr
from gtts import gTTS
import base64
from io import BytesIO
import os

app = Flask(__name__)
MODEL_NAME = "facebook/nllb-200-distilled-600M"
_tokenizer = None
_model = None

def load_translation_model():
    global _tokenizer, _model
    if _tokenizer is None or _model is None:
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    return _tokenizer, _model

def translate_to_hindi(text: str, source_lang: str = "eng_Latn") -> str:
    tokenizer, model = load_translation_model()
    tokenizer.src_lang = source_lang
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    hindi_id = tokenizer.convert_tokens_to_ids("hin_Deva")
    with torch.no_grad():
        output = model.generate(**inputs, forced_bos_token_id=hindi_id, max_length=512, num_beams=4)
    return tokenizer.batch_decode(output, skip_special_tokens=True)[0]

@app.get("/")
def index():
    return render_template("index.html")

@app.post("/api/translate")
def translate():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    source_lang = data.get("source_lang") or "eng_Latn"
    if not text:
        return jsonify({"error": "Please enter some text."}), 400
    try:
        return jsonify({"translated_text": translate_to_hindi(text, source_lang)})
    except Exception as exc:
        return jsonify({"error": f"Translation failed: {exc}"}), 500

@app.post("/api/speech")
def speech():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file received."}), 400
    temp_path = "_recording.wav"
    request.files["audio"].save(temp_path)
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(temp_path) as source:
            audio = recognizer.record(source)
        text = recognizer.recognize_google(audio)
        translated = translate_to_hindi(text, "eng_Latn")
        buf = BytesIO()
        gTTS(text=translated, lang="hi").write_to_fp(buf)
        return jsonify({"recognized_text": text, "translated_text": translated,
                        "audio_base64": base64.b64encode(buf.getvalue()).decode("utf-8")})
    except sr.UnknownValueError:
        return jsonify({"error": "I could not understand the audio."}), 400
    except Exception as exc:
        return jsonify({"error": f"Voice processing failed: {exc}"}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(debug=True)

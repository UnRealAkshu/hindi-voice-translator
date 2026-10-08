from flask import Flask, jsonify, render_template, request
from translator import translate_to_hindi

app = Flask(__name__)


@app.get("/")
def home():
    """Open the web interface."""
    return render_template("index.html")


@app.post("/api/translate")
def translate():
    """Receive English text and return Hindi text."""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "Please enter some English text."}), 400

    try:
        hindi = translate_to_hindi(text)
        return jsonify({"hindi": hindi})
    except Exception as error:
        return jsonify({"error": str(error)}), 500


@app.get("/api/health")
def health():
    """Simple health-check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

import os
import tempfile
from pathlib import Path

from faster_whisper import WhisperModel


_MODEL = None


def load_whisper():
    """
    Load the small Whisper model once and reuse it.

    CPU int8 is chosen because it works on ordinary student laptops
    without requiring CUDA setup.
    """
    global _MODEL

    if _MODEL is None:
        cpu_threads = max(4, min(8, os.cpu_count() or 4))
        print("Loading local Whisper tiny.en model...")
        _MODEL = WhisperModel(
            "tiny.en",
            device="cpu",
            compute_type="int8",
            cpu_threads=cpu_threads,
        )
        print("Whisper model loaded.")

    return _MODEL


def transcribe_audio(uploaded_file) -> str:
    """Save one browser recording temporarily and transcribe it locally."""
    suffix = Path(uploaded_file.filename or "recording.webm").suffix or ".webm"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            uploaded_file.save(temp.name)
            temp_path = temp.name

        model = load_whisper()

        segments, _info = model.transcribe(
            temp_path,
            language="en",
            beam_size=1,
            best_of=1,
            temperature=0,
            vad_filter=True,
            condition_on_previous_text=False,
        )

        text = " ".join(segment.text.strip() for segment in segments).strip()

        if not text:
            raise ValueError("No speech was detected. Please speak a little louder.")

        return text

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    print("Local Whisper test module loaded.")

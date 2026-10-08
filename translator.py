from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch


# A smaller English -> Hindi neural machine translation model.
MODEL_NAME = "Helsinki-NLP/opus-mt-en-hi"

_tokenizer = None
_model = None


def load_model():
    """Load the ML model only once and reuse it for every translation."""
    global _tokenizer, _model

    if _tokenizer is None or _model is None:
        print("Loading translation model...")
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
        _model.eval()
        print("Translation model loaded.")

    return _tokenizer, _model


def translate_to_hindi(text: str) -> str:
    """Translate English text into Hindi using the neural model."""
    tokenizer, model = load_model()

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=128,
    )

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=128,
            num_beams=2,  # small beam search = faster response
        )

    result = tokenizer.decode(output_ids[0], skip_special_tokens=True)
    return result.strip()


if __name__ == "__main__":
    # Easy test for students learning the project.
    print(translate_to_hindi("Where are you going?"))

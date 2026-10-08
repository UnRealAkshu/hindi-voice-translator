import { pipeline } from "@huggingface/transformers";
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">हि</div>
        <div>
          <strong>HindiVoice</strong>
          <span>AI Translator</span>
        </div>
      </div>
      <div class="status-chip" id="modelStatus">
        <i></i><span>ML model ready to load</span>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="badge">MACHINE LEARNING WEB APP</div>
        <h1>Say it in English.<br><span>Hear it in Hindi.</span></h1>
        <p>Translate English text or speak into your microphone. Neural translation runs directly in your browser.</p>
      </section>

      <section class="workspace">
        <article class="panel input-panel">
          <div class="panel-head">
            <div>
              <label>INPUT</label>
              <h2>English</h2>
            </div>
            <span class="lang-code">eng_Latn</span>
          </div>

          <textarea id="input" placeholder="Type something like “Where are you going?”"></textarea>

          <div class="control-row">
            <button class="btn btn-primary" id="translateBtn">Translate <span>→</span></button>
            <button class="btn btn-ghost" id="micBtn"><span class="mic-dot">●</span> Speak</button>
            <button class="btn btn-icon" id="clearBtn" title="Clear">⌫</button>
          </div>
          <div class="hint" id="micHint">Microphone uses your browser's speech recognition.</div>
        </article>

        <article class="panel output-panel">
          <div class="panel-head">
            <div>
              <label>OUTPUT</label>
              <h2>Hindi</h2>
            </div>
            <span class="lang-code">hin_Deva</span>
          </div>

          <div class="translation-box" id="output">हिंदी अनुवाद यहाँ दिखाई देगा।</div>

          <div class="output-actions">
            <button class="btn btn-dark" id="speakBtn" disabled>🔊 Speak Hindi</button>
            <button class="btn btn-dark" id="copyBtn" disabled>Copy</button>
          </div>
          <div class="recognized" id="recognized"></div>
        </article>
      </section>

      <section class="pipeline">
        <div class="section-label">HOW IT WORKS</div>
        <div class="flow">
          <div class="flow-item"><b>01</b><span>Speech recognition</span><small>Browser microphone</small></div>
          <div class="flow-arrow">→</div>
          <div class="flow-item"><b>02</b><span>Neural translation</span><small>Marian MT model</small></div>
          <div class="flow-arrow">→</div>
          <div class="flow-item"><b>03</b><span>Hindi speech</span><small>Browser text-to-speech</small></div>
        </div>
      </section>

      <section class="note">
        <span>🧠</span>
        <div><strong>ML runs in your browser.</strong> The translation model is downloaded once and cached locally by your browser for faster future translations.</div>
      </section>
    </main>

    <footer>Built with Transformers.js · ONNX Runtime · Vite · Web Speech API</footer>
  </div>
`;

const input = document.querySelector("#input");
const output = document.querySelector("#output");
const translateBtn = document.querySelector("#translateBtn");
const micBtn = document.querySelector("#micBtn");
const clearBtn = document.querySelector("#clearBtn");
const speakBtn = document.querySelector("#speakBtn");
const copyBtn = document.querySelector("#copyBtn");
const recognized = document.querySelector("#recognized");
const micHint = document.querySelector("#micHint");
const modelStatus = document.querySelector("#modelStatus");

let translatorPromise = null;
let lastHindi = "";
let recognition = null;

function setModelStatus(text, state = "idle") {
  modelStatus.className = `status-chip ${state}`;
  modelStatus.querySelector("span").textContent = text;
}

function setButtonLoading(button, loading, label) {
  button.disabled = loading;
  button.innerHTML = loading ? `<span class="spinner"></span>${label}` : label;
}

async function getTranslator() {
  if (!translatorPromise) {
    translatorPromise = (async () => {
      setModelStatus("Downloading ML model…", "loading");
      const useWebGPU = "gpu" in navigator;
      try {
        const options = useWebGPU
          ? { device: "webgpu", dtype: "q4" }
          : { dtype: "q4" };
        const pipe = await pipeline("translation", "Xenova/opus-mt-en-hi", options);
        setModelStatus(useWebGPU ? "ML model · WebGPU" : "ML model · CPU", "ready");
        return pipe;
      } catch (firstError) {
        try {
          const pipe = await pipeline("translation", "Xenova/opus-mt-en-hi", { dtype: "q8" });
          setModelStatus("ML model · CPU", "ready");
          return pipe;
        } catch (secondError) {
          translatorPromise = null;
          setModelStatus("ML model failed to load", "error");
          throw secondError;
        }
      }
    })();
  }
  return translatorPromise;
}

async function translateText(text) {
  const clean = text.trim();
  if (!clean) throw new Error("Please enter some English text.");
  const translator = await getTranslator();
  const result = await translator(clean);
  return result[0].translation_text;
}

async function translateFromText() {
  const text = input.value.trim();
  if (!text) return;
  setButtonLoading(translateBtn, true, "Translating…");
  try {
    const hindi = await translateText(text);
    setResult(hindi, "");
  } catch (error) {
    setModelStatus(error.message || "Translation failed", "error");
  } finally {
    translateBtn.disabled = false;
    translateBtn.innerHTML = `Translate <span>→</span>`;
  }
}

function setResult(hindi, spokenText) {
  lastHindi = hindi;
  output.textContent = hindi;
  speakBtn.disabled = false;
  copyBtn.disabled = false;
  recognized.textContent = spokenText ? `Recognized: ${spokenText}` : "";
}

function speakHindi() {
  if (!lastHindi || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(lastHindi);
  utterance.lang = "hi-IN";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function initSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    micBtn.disabled = true;
    micHint.textContent = "Voice input is not supported by this browser. Try Chrome or Edge.";
    return;
  }

  recognition = new Recognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    micBtn.classList.add("recording");
    micBtn.innerHTML = `<span class="pulse"></span> Listening…`;
    micHint.textContent = "Speak clearly in English.";
  };

  recognition.onend = () => {
    micBtn.classList.remove("recording");
    micBtn.innerHTML = `<span class="mic-dot">●</span> Speak`;
  };

  recognition.onerror = (event) => {
    micHint.textContent = `Microphone error: ${event.error}`;
    micBtn.classList.remove("recording");
    micBtn.innerHTML = `<span class="mic-dot">●</span> Speak`;
  };

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    input.value = text;
    recognized.textContent = `Recognized: ${text}`;
    micHint.textContent = "Translating your voice…";
    try {
      const hindi = await translateText(text);
      setResult(hindi, text);
      speakHindi();
      micHint.textContent = "Done — Hindi audio is playing.";
    } catch (error) {
      micHint.textContent = error.message || "Translation failed.";
    }
  };
}

translateBtn.addEventListener("click", translateFromText);

input.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") translateFromText();
});

micBtn.addEventListener("click", () => {
  if (!recognition) return;
  try { recognition.start(); } catch (_) {}
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  output.textContent = "हिंदी अनुवाद यहाँ दिखाई देगा।";
  recognized.textContent = "";
  lastHindi = "";
  speakBtn.disabled = true;
  copyBtn.disabled = true;
  micHint.textContent = "Microphone uses your browser's speech recognition.";
});

speakBtn.addEventListener("click", speakHindi);

copyBtn.addEventListener("click", async () => {
  if (!lastHindi) return;
  await navigator.clipboard.writeText(lastHindi);
  copyBtn.textContent = "Copied ✓";
  setTimeout(() => copyBtn.textContent = "Copy", 1200);
});

initSpeechRecognition();

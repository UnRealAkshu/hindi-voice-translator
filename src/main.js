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
      <div class="status-chip" id="modelStatus"><i></i><span>ML models ready to load</span></div>
    </header>

    <main>
      <section class="hero">
        <div class="badge">MACHINE LEARNING WEB APP</div>
        <h1>Say it in English.<br><span>Hear it in Hindi.</span></h1>
        <p>Type an English sentence or record your voice. Translation and speech recognition are powered by ML models running in your browser.</p>
      </section>

      <section class="workspace">
        <article class="panel input-panel">
          <div class="panel-head">
            <div><label>INPUT</label><h2>English</h2></div>
            <span class="lang-code">eng_Latn</span>
          </div>

          <textarea id="input" placeholder="Type something like “Where are you going?”"></textarea>

          <div class="control-row">
            <button class="btn btn-primary" id="translateBtn">Translate <span>→</span></button>
            <button class="btn btn-ghost" id="micBtn"><span class="mic-dot">●</span> Speak</button>
            <button class="btn btn-icon" id="clearBtn" title="Clear">⌫</button>
          </div>
          <div class="hint" id="micHint">Voice mode uses on-device Whisper ML — no browser SpeechRecognition service.</div>
        </article>

        <article class="panel output-panel">
          <div class="panel-head">
            <div><label>OUTPUT</label><h2>Hindi</h2></div>
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
          <div class="flow-item"><b>01</b><span>Whisper speech-to-text</span><small>On-device ML</small></div>
          <div class="flow-arrow">→</div>
          <div class="flow-item"><b>02</b><span>Neural translation</span><small>English → Hindi</small></div>
          <div class="flow-arrow">→</div>
          <div class="flow-item"><b>03</b><span>Hindi speech</span><small>Browser synthesis</small></div>
        </div>
      </section>

      <section class="note">
        <span>🧠</span>
        <div><strong>No SpeechRecognition network dependency.</strong> The microphone recording is converted to audio data in the browser and transcribed by Whisper ML, which fixes the “network” error you were seeing.</div>
      </section>
    </main>

    <footer>Built with Transformers.js · Whisper · Marian MT · ONNX Runtime · Vite</footer>
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
let transcriberPromise = null;
let lastHindi = "";
let mediaRecorder = null;
let recordedChunks = [];

function setModelStatus(text, state = "idle") {
  modelStatus.className = `status-chip ${state}`;
  modelStatus.querySelector("span").textContent = text;
}

function setResult(hindi, spokenText) {
  lastHindi = hindi;
  output.textContent = hindi;
  speakBtn.disabled = false;
  copyBtn.disabled = false;
  recognized.textContent = spokenText ? `Recognized: ${spokenText}` : "";
}

async function getTranslator() {
  if (!translatorPromise) {
    translatorPromise = (async () => {
      setModelStatus("Loading translation ML…", "loading");
      try {
        const useWebGPU = "gpu" in navigator;
        const options = useWebGPU ? { device: "webgpu", dtype: "q4" } : { dtype: "q4" };
        const pipe = await pipeline("translation", "Xenova/opus-mt-en-hi", options);
        setModelStatus(useWebGPU ? "Translation ML · WebGPU" : "Translation ML · CPU", "ready");
        return pipe;
      } catch (firstError) {
        try {
          const pipe = await pipeline("translation", "Xenova/opus-mt-en-hi", { dtype: "q8" });
          setModelStatus("Translation ML · CPU", "ready");
          return pipe;
        } catch (secondError) {
          translatorPromise = null;
          setModelStatus("Translation model failed", "error");
          throw secondError;
        }
      }
    })();
  }
  return translatorPromise;
}

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      setModelStatus("Loading Whisper speech ML…", "loading");
      try {
        const useWebGPU = "gpu" in navigator;
        const options = useWebGPU ? { device: "webgpu", dtype: "q4" } : { dtype: "q8" };
        const pipe = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", options);
        setModelStatus(useWebGPU ? "Whisper ML · WebGPU" : "Whisper ML · CPU", "ready");
        return pipe;
      } catch (error) {
        transcriberPromise = null;
        setModelStatus("Whisper model failed", "error");
        throw error;
      }
    })();
  }
  return transcriberPromise;
}

async function translateText(text) {
  const clean = text.trim();
  if (!clean) throw new Error("Please enter some English text.");
  const translator = await getTranslator();
  const result = await translator(clean);
  return result[0].translation_text.trim();
}

async function translateFromText() {
  const text = input.value.trim();
  if (!text) return;

  translateBtn.disabled = true;
  translateBtn.innerHTML = '<span class="spinner"></span>Translating…';

  try {
    const hindi = await translateText(text);
    setResult(hindi, "");
  } catch (error) {
    setModelStatus(error.message || "Translation failed", "error");
  } finally {
    translateBtn.disabled = false;
    translateBtn.innerHTML = 'Translate <span>→</span>';
  }
}

function speakHindi() {
  if (!lastHindi || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(lastHindi);
  utterance.lang = "hi-IN";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

async function blobTo16kMono(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Web Audio is not supported by this browser.");

  const context = new AudioContextClass();
  const decoded = await context.decodeAudioData(arrayBuffer);
  const source = context.createBufferSource();
  source.buffer = decoded;

  const targetRate = 16000;
  const targetLength = Math.ceil(decoded.duration * targetRate);
  const offline = new OfflineAudioContext(1, targetLength, targetRate);

  const offlineSource = offline.createBufferSource();
  offlineSource.buffer = decoded;
  offlineSource.connect(offline.destination);
  offlineSource.start(0);

  const rendered = await offline.startRendering();
  const channel = rendered.getChannelData(0);

  source.disconnect();
  await context.close();
  return channel;
}

async function transcribeAudio(blob) {
  const transcriber = await getTranscriber();
  const audioData = await blobTo16kMono(blob);
  const result = await transcriber(audioData, { chunk_length_s: 30, stride_length_s: 5 });
  return (result.text || "").trim();
}

function setRecordingUi(recording) {
  if (recording) {
    micBtn.classList.add("recording");
    micBtn.innerHTML = '<span class="pulse"></span> Stop';
    micHint.textContent = "Listening… speak in English, then press Stop.";
  } else {
    micBtn.classList.remove("recording");
    micBtn.innerHTML = '<span class="mic-dot">●</span> Speak';
  }
}

async function startVoice() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    micHint.textContent = "This browser does not support microphone recording. Try Chrome or Edge.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      setRecordingUi(false);

      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      micHint.textContent = "Running Whisper speech-to-text…";
      micBtn.disabled = true;

      try {
        const text = await transcribeAudio(blob);
        if (!text) throw new Error("Whisper could not detect any speech.");

        input.value = text;
        recognized.textContent = `Recognized: ${text}`;
        micHint.textContent = "Translating to Hindi…";

        const hindi = await translateText(text);
        setResult(hindi, text);
        speakHindi();
        micHint.textContent = "Done — Hindi audio is playing.";
      } catch (error) {
        micHint.textContent = error.message || "Voice processing failed.";
      } finally {
        micBtn.disabled = false;
      }
    };

    mediaRecorder.start();
    setRecordingUi(true);
  } catch (error) {
    micHint.textContent =
      error.name === "NotAllowedError"
        ? "Microphone permission was blocked. Allow microphone access for this site and try again."
        : `Microphone error: ${error.message}`;
  }
}

function stopVoice() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

translateBtn.addEventListener("click", translateFromText);

input.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") translateFromText();
});

micBtn.addEventListener("click", () => {
  if (mediaRecorder?.state === "recording") stopVoice();
  else startVoice();
});

clearBtn.addEventListener("click", () => {
  if (mediaRecorder?.state === "recording") stopVoice();
  input.value = "";
  output.textContent = "हिंदी अनुवाद यहाँ दिखाई देगा।";
  recognized.textContent = "";
  lastHindi = "";
  speakBtn.disabled = true;
  copyBtn.disabled = true;
  micHint.textContent = "Voice mode uses on-device Whisper ML — no browser SpeechRecognition service.";
});

speakBtn.addEventListener("click", speakHindi);

copyBtn.addEventListener("click", async () => {
  if (!lastHindi) return;
  await navigator.clipboard.writeText(lastHindi);
  copyBtn.textContent = "Copied ✓";
  setTimeout(() => copyBtn.textContent = "Copy", 1200);
});

import { pipeline } from "@huggingface/transformers";
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">हि</div>
        <div><strong>HindiVoice</strong><span>AI Translator</span></div>
      </div>
      <div class="status-chip" id="modelStatus"><i></i><span>Ready</span></div>
    </header>

    <main>
      <section class="hero">
        <div class="badge">LIVE AI TRANSLATOR</div>
        <h1>Talk naturally.<br><span>Hear Hindi instantly.</span></h1>
        <p>Fast local speech recognition, neural translation and Hindi voice playback — designed to feel like a live interpreter.</p>
      </section>

      <section class="live-card panel">
        <div class="live-head">
          <div>
            <label>LIVE INTERPRETER</label>
            <h2>English → Hindi</h2>
          </div>
          <div class="live-state" id="liveState"><i></i><span>OFF</span></div>
        </div>
        <div class="live-grid">
          <div class="live-transcript">
            <div class="mini-label">YOU SAID</div>
            <div id="liveEnglish">Start Live Translate and speak normally.</div>
          </div>
          <div class="live-arrow">→</div>
          <div class="live-transcript hindi">
            <div class="mini-label">HINDI</div>
            <div id="liveHindi">आपका अनुवाद यहाँ आएगा।</div>
          </div>
        </div>
        <div class="live-actions">
          <button class="btn btn-primary live-btn" id="liveBtn">● Start Live Translate</button>
          <label class="toggle"><input id="autoSpeak" type="checkbox" checked><span></span> Auto speak Hindi</label>
        </div>
        <div class="hint" id="liveHint">For the lowest latency, Chrome/Chromium with on-device speech recognition is preferred. Whisper ML is used as a fallback.</div>
      </section>

      <section class="workspace">
        <article class="panel">
          <div class="panel-head"><div><label>TEXT MODE</label><h2>English</h2></div><span class="lang-code">eng_Latn</span></div>
          <textarea id="input" placeholder="Type something like “Where are you going?”"></textarea>
          <div class="control-row">
            <button class="btn btn-primary" id="translateBtn">Translate <span>→</span></button>
            <button class="btn btn-dark" id="speakBtn" disabled>🔊 Speak Hindi</button>
            <button class="btn btn-icon" id="clearBtn" title="Clear">⌫</button>
          </div>
          <div class="hint">Text mode is useful for testing the translation model separately.</div>
        </article>

        <article class="panel">
          <div class="panel-head"><div><label>HINDI OUTPUT</label><h2>Translation</h2></div><span class="lang-code">hin_Deva</span></div>
          <div class="translation-box" id="output">हिंदी अनुवाद यहाँ दिखाई देगा।</div>
          <div class="output-actions">
            <button class="btn btn-dark" id="copyBtn" disabled>Copy</button>
          </div>
          <div class="recognized" id="recognized"></div>
        </article>
      </section>

      <section class="pipeline">
        <div class="section-label">LIVE PIPELINE</div>
        <div class="flow">
          <div class="flow-item"><b>01</b><span>Local speech</span><small>On-device / browser</small></div>
          <div class="flow-arrow">→</div>
          <div class="flow-item"><b>02</b><span>Neural translation</span><small>English → Hindi</small></div>
          <div class="flow-arrow">→</div>
          <div class="flow-item"><b>03</b><span>Hindi voice</span><small>Speech synthesis</small></div>
        </div>
      </section>

      <section class="note">
        <span>⚡</span>
        <div><strong>Samsung-style behavior, within browser limits.</strong> The app pauses recognition while Hindi is spoken to avoid translating its own output, then resumes automatically for the next turn.</div>
      </section>
    </main>

    <footer>Built with Transformers.js · Whisper · Web Speech API · Vite</footer>
  </div>
`;

const input = document.querySelector("#input");
const output = document.querySelector("#output");
const translateBtn = document.querySelector("#translateBtn");
const speakBtn = document.querySelector("#speakBtn");
const copyBtn = document.querySelector("#copyBtn");
const clearBtn = document.querySelector("#clearBtn");
const modelStatus = document.querySelector("#modelStatus");
const liveBtn = document.querySelector("#liveBtn");
const liveState = document.querySelector("#liveState");
const liveEnglish = document.querySelector("#liveEnglish");
const liveHindi = document.querySelector("#liveHindi");
const liveHint = document.querySelector("#liveHint");
const autoSpeak = document.querySelector("#autoSpeak");
const recognized = document.querySelector("#recognized");

let translatorPromise = null;
let transcriberPromise = null;
let liveRecognition = null;
let liveRunning = false;
let liveUsingLocalRecognition = false;
let lastHindi = "";
let lastFinalIndex = -1;

function setModelStatus(text, state="idle"){
  modelStatus.className = `status-chip ${state}`;
  modelStatus.querySelector("span").textContent = text;
}

function setLiveState(on){
  liveState.className = `live-state ${on ? "on" : ""}`;
  liveState.querySelector("span").textContent = on ? "LIVE" : "OFF";
  liveBtn.textContent = on ? "■ Stop Live Translate" : "● Start Live Translate";
  liveBtn.classList.toggle("danger", on);
}

function getHindiVoice(){
  if(!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => /^hi(-|_)/i.test(v.lang))
      || voices.find(v => /hindi/i.test(v.name))
      || voices.find(v => /india/i.test(v.lang))
      || null;
}

function speakHindi(text = lastHindi, onEnd = null){
  if(!text || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = getHindiVoice();
  u.lang = voice?.lang || "hi-IN";
  if(voice) u.voice = voice;
  u.rate = 0.98;
  u.pitch = 1;
  u.volume = 1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

if("speechSynthesis" in window){
  window.speechSynthesis.onvoiceschanged = () => getHindiVoice();
}

function setResult(hindi, spokenText=""){
  lastHindi = hindi;
  output.textContent = hindi;
  liveHindi.textContent = hindi;
  speakBtn.disabled = false;
  copyBtn.disabled = false;
  recognized.textContent = spokenText ? `Recognized: ${spokenText}` : "";
}

async function getTranslator(){
  if(!translatorPromise){
    translatorPromise = (async()=>{
      setModelStatus("Loading translation ML…","loading");
      try{
        const useWebGPU = !!navigator.gpu;
        const pipe = await pipeline(
          "translation",
          "Xenova/opus-mt-en-hi",
          useWebGPU ? {device:"webgpu",dtype:"q4"} : {dtype:"q4"}
        );
        setModelStatus(useWebGPU ? "Translation · WebGPU" : "Translation · CPU","ready");
        return pipe;
      }catch{
        const pipe = await pipeline("translation","Xenova/opus-mt-en-hi",{dtype:"q8"});
        setModelStatus("Translation · CPU","ready");
        return pipe;
      }
    })();
  }
  return translatorPromise;
}

async function getWhisper(){
  if(!transcriberPromise){
    transcriberPromise = (async()=>{
      setModelStatus("Loading Whisper ML…","loading");
      try{
        const useWebGPU = !!navigator.gpu;
        const pipe = await pipeline(
          "automatic-speech-recognition",
          "onnx-community/whisper-tiny.en",
          useWebGPU ? {device:"webgpu",dtype:"q4"} : {dtype:"q8"}
        );
        setModelStatus(useWebGPU ? "Whisper · WebGPU" : "Whisper · CPU","ready");
        return pipe;
      }catch(error){
        transcriberPromise = null;
        setModelStatus("Whisper failed","error");
        throw error;
      }
    })();
  }
  return transcriberPromise;
}

async function translateText(text){
  const clean = text.trim();
  if(!clean) throw new Error("Please enter some English text.");
  const translator = await getTranslator();
  const result = await translator(clean);
  return result[0].translation_text.trim();
}

async function translateFromText(){
  const text=input.value.trim();
  if(!text) return;
  translateBtn.disabled=true;
  translateBtn.innerHTML='<span class="spinner"></span>Translating…';
  try{
    const hindi=await translateText(text);
    setResult(hindi,text);
  }catch(error){
    setModelStatus(error.message||"Translation failed","error");
  }finally{
    translateBtn.disabled=false;
    translateBtn.innerHTML='Translate <span>→</span>';
  }
}

function createRecognition(){
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Recognition) return null;
  const r = new Recognition();
  r.lang="en-IN";
  r.continuous=true;
  r.interimResults=true;
  r.maxAlternatives=1;

  if("processLocally" in r) r.processLocally = true;
  return r;
}

async function prepareLocalRecognition(){
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Recognition) return false;

  try{
    if("available" in Recognition && "install" in Recognition){
      const result = await Recognition.available({
        langs:["en-IN"],
        processLocally:true,
        quality:"dictation"
      });

      if(result === "downloadable" || result === "downloading"){
        liveHint.textContent = "Downloading the browser's on-device English language pack…";
        await Recognition.install({langs:["en-IN"]});
      } else if(result === "unavailable"){
        return false;
      }
    }
    return true;
  }catch{
    return false;
  }
}

async function handleFinalSpeech(text){
  if(!liveRunning || !text.trim()) return;

  liveRecognition?.stop();
  const english = text.trim();
  liveEnglish.textContent = english;
  input.value = english;
  recognized.textContent = `Recognized: ${english}`;
  liveHint.textContent = "Translating…";

  try{
    const hindi = await translateText(english);
    setResult(hindi, english);
    liveHint.textContent = getHindiVoice()
      ? "Live — Hindi audio is playing."
      : "Hindi translation ready. Your browser has no Hindi voice installed.";

    if(autoSpeak.checked){
      speakHindi(hindi, ()=> {
        if(liveRunning){
          setTimeout(()=>{ try{ liveRecognition?.start(); }catch{} },120);
        }
      });
    }else if(liveRunning){
      setTimeout(()=>{ try{ liveRecognition?.start(); }catch{} },120);
    }
  }catch(error){
    liveHint.textContent = error.message || "Translation failed.";
    if(liveRunning) setTimeout(()=>{ try{ liveRecognition?.start(); }catch{} },250);
  }
}

async function startLive(){
  liveRunning = true;
  setLiveState(true);

  const localAvailable = await prepareLocalRecognition();
  if(localAvailable){
    liveUsingLocalRecognition = true;
    liveRecognition = createRecognition();
    liveRecognition.onstart = ()=>{
      setModelStatus("Live speech · On-device","ready");
      liveHint.textContent = "Listening… speak naturally.";
    };
    liveRecognition.onresult = async(event)=>{
      let finalText = "";
      let interim = "";
      for(let i=event.resultIndex;i<event.results.length;i++){
        const part = event.results[i][0].transcript;
        if(event.results[i].isFinal) finalText += part + " ";
        else interim += part;
      }
      if(interim) liveEnglish.textContent = interim;
      if(finalText) await handleFinalSpeech(finalText);
    };
    liveRecognition.onerror = async(event)=>{
      if(event.error==="not-allowed"){
        liveHint.textContent="Microphone permission was blocked. Allow microphone access and try again.";
      }else{
        liveHint.textContent=`Live speech error: ${event.error}`;
      }
    };
    liveRecognition.onend = ()=>{
      if(liveRunning && window.speechSynthesis.speaking===false){
        setTimeout(()=>{try{liveRecognition.start();}catch{}},150);
      }
    };
    try{liveRecognition.start();}catch{}
    return;
  }

  liveUsingLocalRecognition=false;
  liveHint.textContent="On-device browser speech is unavailable here. Starting Whisper fallback — this is slower but fully ML-based.";
  try{
    await getWhisper();
    liveHint.textContent="Whisper fallback is ready. For Samsung-like low latency, use Chrome with on-device speech enabled.";
    // Keep the explicit fallback available through the same mic flow.
    alert("This browser does not provide on-device live speech recognition. Use Chrome for low-latency Live Translate; Whisper fallback is available in the full recording flow.");
    stopLive();
  }catch(error){
    liveHint.textContent=error.message || "Voice ML could not be loaded.";
    stopLive();
  }
}

function stopLive(){
  liveRunning=false;
  setLiveState(false);
  try{liveRecognition?.stop();}catch{}
  window.speechSynthesis?.cancel();
  liveHint.textContent = "Live translation stopped.";
}

liveBtn.addEventListener("click",()=>{
  if(liveRunning) stopLive(); else startLive();
});

translateBtn.addEventListener("click",translateFromText);

input.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==="Enter") translateFromText();
});

speakBtn.addEventListener("click",()=>speakHindi());

copyBtn.addEventListener("click",async()=>{
  if(!lastHindi) return;
  await navigator.clipboard.writeText(lastHindi);
  copyBtn.textContent="Copied ✓";
  setTimeout(()=>copyBtn.textContent="Copy",1200);
});

clearBtn.addEventListener("click",()=>{
  input.value="";
  output.textContent="हिंदी अनुवाद यहाँ दिखाई देगा।";
  liveEnglish.textContent="Start Live Translate and speak normally.";
  liveHindi.textContent="आपका अनुवाद यहाँ आएगा।";
  recognized.textContent="";
  lastHindi="";
  speakBtn.disabled=true;
  copyBtn.disabled=true;
  window.speechSynthesis?.cancel();
});

setTimeout(()=>{
  // Warm the translation model after first paint so the first demo interaction is faster.
  getTranslator().catch(()=>{});
},900);

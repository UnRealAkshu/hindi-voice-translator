const textInput = document.getElementById("textInput");
const result = document.getElementById("result");
const translateBtn = document.getElementById("translateBtn");
const speakBtn = document.getElementById("speakBtn");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

const liveBtn = document.getElementById("liveBtn");
const liveStatus = document.getElementById("liveStatus");
const liveEnglish = document.getElementById("liveEnglish");
const liveHindi = document.getElementById("liveHindi");
const voiceMessage = document.getElementById("voiceMessage");
const autoSpeak = document.getElementById("autoSpeak");

let currentHindi = "";
let liveMode = false;
let translating = false;
let recording = false;
let mediaRecorder = null;
let mediaStream = null;
let audioContext = null;
let analyser = null;
let audioFrame = null;
let silenceTimer = null;
let speechStarted = false;
let speechStartTime = 0;

const START_THRESHOLD = 0.018;
const SILENCE_THRESHOLD = 0.010;
const SILENCE_MS = 800;
const MIN_SPEECH_MS = 450;
const MAX_TURN_MS = 10000;

function setButtonsDisabled(disabled) {
    translateBtn.disabled = disabled;
    translateBtn.textContent = disabled ? "Translating..." : "Translate →";
}

async function translateText(text) {
    const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Translation failed.");
    }

    return data.hindi;
}

async function transcribeRecording(blob) {
    const formData = new FormData();
    formData.append("audio", blob, "voice-turn.webm");

    const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Speech recognition failed.");
    }

    return (data.text || "").trim();
}

function speakHindi(text, onFinished = null) {
    if (!text || !window.speechSynthesis) {
        voiceMessage.textContent =
            "Hindi speech is not available in this browser.";
        onFinished?.();
        return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "hi-IN";
    speech.rate = 0.95;
    speech.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const hindiVoice =
        voices.find(v => v.lang.toLowerCase().startsWith("hi")) ||
        voices.find(v => v.name.toLowerCase().includes("hindi"));

    if (hindiVoice) {
        speech.voice = hindiVoice;
    }

    speech.onstart = () => {
        voiceMessage.textContent = "Speaking Hindi…";
    };

    speech.onend = () => {
        if (liveMode) {
            voiceMessage.textContent = "Listening for the next sentence…";
        } else {
            voiceMessage.textContent = "Hindi audio finished.";
        }

        onFinished?.();
    };

    speech.onerror = () => {
        onFinished?.();
    };

    window.speechSynthesis.speak(speech);
}

async function doTranslation(text, fromLive = false) {
    if (!text.trim() || translating) {
        return;
    }

    translating = true;

    try {
        if (!fromLive) {
            setButtonsDisabled(true);
        }

        voiceMessage.textContent = fromLive
            ? "Translating to Hindi…"
            : "Translating…";

        const hindi = await translateText(text);

        currentHindi = hindi;
        result.textContent = hindi;
        liveHindi.textContent = hindi;
        speakBtn.disabled = false;
        copyBtn.disabled = false;

        if (fromLive) {
            if (autoSpeak.checked) {
                speakHindi(hindi, () => {
                    if (liveMode) {
                        startRecordingTurn();
                    }
                });
            } else if (liveMode) {
                startRecordingTurn();
            }
        }
    } catch (error) {
        if (fromLive) {
            voiceMessage.textContent = "Translation error: " + error.message;
            if (liveMode) {
                setTimeout(startRecordingTurn, 300);
            }
        } else {
            result.textContent = error.message;
        }
    } finally {
        translating = false;

        if (!fromLive) {
            setButtonsDisabled(false);
        }
    }
}

async function processVoiceTurn(blob) {
    voiceMessage.textContent = "Understanding your speech…";

    try {
        const text = await transcribeRecording(blob);

        if (!text) {
            throw new Error("No speech detected. Please speak again.");
        }

        liveEnglish.textContent = text;
        textInput.value = text;

        await doTranslation(text, true);
    } catch (error) {
        voiceMessage.textContent = error.message;

        if (liveMode) {
            setTimeout(startRecordingTurn, 500);
        }
    }
}

function cleanupAudio() {
    if (audioFrame) {
        cancelAnimationFrame(audioFrame);
        audioFrame = null;
    }

    clearTimeout(silenceTimer);
    silenceTimer = null;

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (audioContext) {
        audioContext.close().catch(() => {});
        audioContext = null;
    }

    analyser = null;
    recording = false;
}

function finishRecordingTurn() {
    if (!mediaRecorder || mediaRecorder.state !== "recording") {
        cleanupAudio();
        return;
    }

    recording = false;
    clearTimeout(silenceTimer);
    silenceTimer = null;

    try {
        mediaRecorder.stop();
    } catch (error) {
        cleanupAudio();
    }
}

function monitorVoice() {
    if (!liveMode || !recording || !analyser) {
        return;
    }

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    let sum = 0;

    for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / data.length);
    const now = performance.now();

    if (!speechStarted) {
        if (rms >= START_THRESHOLD) {
            speechStarted = true;
            speechStartTime = now;
            voiceMessage.textContent = "Listening…";
        }
    } else {
        if (rms < SILENCE_THRESHOLD) {
            if (!silenceTimer) {
                silenceTimer = setTimeout(() => {
                    const speechDuration = performance.now() - speechStartTime;

                    if (speechDuration >= MIN_SPEECH_MS) {
                        finishRecordingTurn();
                    } else {
                        silenceTimer = null;
                    }
                }, SILENCE_MS);
            }
        } else {
            clearTimeout(silenceTimer);
            silenceTimer = null;
        }

        if (now - speechStartTime > MAX_TURN_MS) {
            finishRecordingTurn();
        }
    }

    audioFrame = requestAnimationFrame(monitorVoice);
}

async function startRecordingTurn() {
    if (!liveMode || recording || translating || window.speechSynthesis?.speaking) {
        return;
    }

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const options = {};

        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            options.mimeType = "audio/webm;codecs=opus";
        }

        mediaRecorder = new MediaRecorder(mediaStream, options);
        const chunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, {
                type: mediaRecorder.mimeType || "audio/webm"
            });

            cleanupAudio();

            if (blob.size > 0 && liveMode) {
                await processVoiceTurn(blob);
            }
        };

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(mediaStream);

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.15;

        source.connect(analyser);

        speechStarted = false;
        speechStartTime = 0;
        recording = true;

        liveStatus.textContent = "LISTENING";
        liveStatus.classList.add("on");
        voiceMessage.textContent =
            "Listening… start speaking when you're ready.";

        mediaRecorder.start();
        audioFrame = requestAnimationFrame(monitorVoice);

    } catch (error) {
        cleanupAudio();

        if (error.name === "NotAllowedError") {
            voiceMessage.textContent =
                "Microphone permission was blocked. Allow microphone access and try again.";
            stopLive(false);
        } else {
            voiceMessage.textContent =
                "Microphone error: " + error.message;

            if (liveMode) {
                setTimeout(startRecordingTurn, 800);
            }
        }
    }
}

function stopLive(showMessage = true) {
    liveMode = false;
    translating = false;

    if (mediaRecorder?.state === "recording") {
        try {
            mediaRecorder.stop();
        } catch (error) {}
    }

    cleanupAudio();

    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    liveBtn.textContent = "● Start Live";
    liveStatus.textContent = "OFF";
    liveStatus.classList.remove("on");

    if (showMessage) {
        voiceMessage.textContent = "Live translation stopped.";
    }
}

translateBtn.addEventListener("click", () => {
    doTranslation(textInput.value);
});

textInput.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        doTranslation(textInput.value);
    }
});

speakBtn.addEventListener("click", () => {
    speakHindi(currentHindi);
});

copyBtn.addEventListener("click", async () => {
    if (!currentHindi) return;

    await navigator.clipboard.writeText(currentHindi);
    copyBtn.textContent = "Copied ✓";

    setTimeout(() => {
        copyBtn.textContent = "Copy";
    }, 1200);
});

clearBtn.addEventListener("click", () => {
    textInput.value = "";
    currentHindi = "";

    result.textContent = "हिंदी अनुवाद यहाँ दिखाई देगा।";
    liveEnglish.textContent = "Press “Start Live” and speak in English.";
    liveHindi.textContent = "आपका अनुवाद यहाँ आएगा।";
    speakBtn.disabled = true;
    copyBtn.disabled = true;
});

liveBtn.addEventListener("click", () => {
    if (liveMode) {
        stopLive();
        return;
    }

    liveMode = true;
    liveBtn.textContent = "■ Stop Live";
    liveStatus.textContent = "LIVE";
    liveStatus.classList.add("on");
    liveEnglish.textContent = "Listening… speak your first sentence.";
    voiceMessage.textContent =
        "Live mode started. Speak naturally. The mic will stop automatically after a short pause.";

    startRecordingTurn();
});

if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

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
let recognition = null;
let liveMode = false;
let translating = false;
let recognitionRunning = false;
let restartTimer = null;
let lastError = "";
let errorCount = 0;

function setButtonsDisabled(disabled) {
    translateBtn.disabled = disabled;
    translateBtn.textContent = disabled ? "Translating..." : "Translate →";
}

async function translateText(text) {
    const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Translation failed.");
    }

    return data.hindi;
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
        voiceMessage.textContent = liveMode
            ? "Listening for the next sentence…"
            : "Hindi audio finished.";
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

    // Do not let the microphone hear the Hindi output.
    if (fromLive) {
        stopRecognitionOnly();
    }

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
        speakBtn.disabled = false;
        copyBtn.disabled = false;

        if (fromLive) {
            liveHindi.textContent = hindi;

            if (autoSpeak.checked) {
                speakHindi(hindi, () => {
                    if (liveMode) {
                        scheduleRecognitionRestart(120);
                    }
                });
            } else {
                scheduleRecognitionRestart(120);
            }
        }

    } catch (error) {
        if (fromLive) {
            voiceMessage.textContent = "Translation error: " + error.message;
            scheduleRecognitionRestart(500);
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
    speakBtn.disabled = true;
    copyBtn.disabled = true;
});

function createRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        voiceMessage.textContent =
            "Live voice is not supported in this browser. Use Google Chrome.";
        return null;
    }

    const r = new SpeechRecognition();

    // One sentence at a time makes the interpreter loop much more reliable.
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onstart = () => {
        recognitionRunning = true;
        errorCount = 0;
        liveStatus.textContent = "LISTENING";
        liveStatus.classList.add("on");
        voiceMessage.textContent = "Listening… speak naturally.";
    };

    r.onresult = event => {
        const spokenText =
            event.results[0][0].transcript.trim();

        if (!spokenText) {
            scheduleRecognitionRestart(150);
            return;
        }

        liveEnglish.textContent = spokenText;
        textInput.value = spokenText;

        // This call stops recognition before the translation/audio cycle.
        doTranslation(spokenText, true);
    };

    r.onerror = event => {
        recognitionRunning = false;
        lastError = event.error;

        if (!liveMode) {
            return;
        }

        // These errors are usually temporary session/browser issues.
        // Do NOT turn Live mode off automatically.
        if (
            event.error === "no-speech" ||
            event.error === "aborted" ||
            event.error === "audio-capture" ||
            event.error === "network"
        ) {
            errorCount += 1;

            if (event.error === "network") {
                voiceMessage.textContent =
                    "Speech service interrupted — retrying…";
            } else if (event.error === "no-speech") {
                voiceMessage.textContent =
                    "No speech detected — still listening…";
            } else {
                voiceMessage.textContent =
                    "Voice session restarted…";
            }

            const delay = Math.min(2500, 200 + errorCount * 300);
            scheduleRecognitionRestart(delay);
            return;
        }

        if (event.error === "not-allowed" ||
            event.error === "service-not-allowed") {
            voiceMessage.textContent =
                "Microphone permission/service was blocked. Allow microphone access and start Live again.";
            stopLive(false);
            return;
        }

        voiceMessage.textContent = "Voice error: " + event.error;
        scheduleRecognitionRestart(800);
    };

    r.onend = () => {
        recognitionRunning = false;

        if (!liveMode || translating || window.speechSynthesis?.speaking) {
            return;
        }

        // SpeechRecognition normally ends after one phrase.
        // Immediately schedule the next listening session.
        scheduleRecognitionRestart(150);
    };

    return r;
}

function startRecognitionOnly() {
    if (!liveMode || translating || window.speechSynthesis?.speaking) {
        return;
    }

    if (!recognition) {
        recognition = createRecognition();
    }

    if (!recognition || recognitionRunning) {
        return;
    }

    try {
        recognition.start();
        recognitionRunning = true;
    } catch (error) {
        recognitionRunning = false;
        scheduleRecognitionRestart(500);
    }
}

function scheduleRecognitionRestart(delay = 150) {
    if (!liveMode || translating || window.speechSynthesis?.speaking) {
        return;
    }

    clearTimeout(restartTimer);

    restartTimer = setTimeout(() => {
        restartTimer = null;
        startRecognitionOnly();
    }, delay);
}

function stopRecognitionOnly() {
    clearTimeout(restartTimer);
    restartTimer = null;

    if (!recognition) {
        return;
    }

    try {
        recognition.stop();
    } catch (error) {
        // Ignore repeated stop calls.
    }

    recognitionRunning = false;
}

function startLive() {
    if (!recognition) {
        recognition = createRecognition();
    }

    if (!recognition) {
        return;
    }

    liveMode = true;
    translating = false;
    errorCount = 0;

    liveBtn.textContent = "■ Stop Live";
    liveStatus.textContent = "LIVE";
    liveStatus.classList.add("on");

    liveEnglish.textContent =
        "Listening… speak your first sentence.";

    voiceMessage.textContent =
        "Live mode started. Speak one sentence at a time.";

    startRecognitionOnly();
}

function stopLive(showMessage = true) {
    liveMode = false;
    translating = false;
    clearTimeout(restartTimer);
    restartTimer = null;

    stopRecognitionOnly();

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

liveBtn.addEventListener("click", () => {
    if (liveMode) {
        stopLive();
    } else {
        startLive();
    }
});

if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

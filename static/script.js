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

function speakHindi(text) {
    if (!text || !window.speechSynthesis) {
        voiceMessage.textContent =
            "Hindi speech is not available in this browser.";
        return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "hi-IN";
    speech.rate = 0.95;
    speech.volume = 1;

    // Prefer a Hindi voice when the browser provides one.
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice =
        voices.find(v => v.lang.toLowerCase().startsWith("hi")) ||
        voices.find(v => v.name.toLowerCase().includes("hindi"));

    if (hindiVoice) {
        speech.voice = hindiVoice;
    }

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

        const hindi = await translateText(text);

        currentHindi = hindi;
        result.textContent = hindi;
        speakBtn.disabled = false;
        copyBtn.disabled = false;

        if (fromLive) {
            liveHindi.textContent = hindi;

            // Stop listening while Hindi audio plays.
            // This prevents the app from translating its own voice.
            stopRecognitionOnly();

            if (autoSpeak.checked) {
                speakHindi(hindi);

                // Continue listening after Hindi playback.
                const waitForSpeech = () => {
                    if (!liveMode) return;

                    if (window.speechSynthesis.speaking) {
                        setTimeout(waitForSpeech, 120);
                    } else {
                        startRecognitionOnly();
                    }
                };

                waitForSpeech();
            } else {
                startRecognitionOnly();
            }
        }

    } catch (error) {
        if (fromLive) {
            voiceMessage.textContent = error.message;
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

    // Indian English is usually better for this student project.
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onstart = () => {
        liveStatus.textContent = "LISTENING";
        liveStatus.classList.add("on");
        voiceMessage.textContent = "Listening… speak naturally.";
    };

    r.onresult = event => {
        const spokenText =
            event.results[0][0].transcript.trim();

        liveEnglish.textContent = spokenText;
        textInput.value = spokenText;

        doTranslation(spokenText, true);
    };

    r.onerror = event => {
        if (event.error === "not-allowed") {
            voiceMessage.textContent =
                "Microphone permission was blocked. Allow microphone access.";
        } else if (event.error === "network") {
            voiceMessage.textContent =
                "Browser speech recognition needs a network connection here. Try Google Chrome.";
        } else {
            voiceMessage.textContent =
                "Voice error: " + event.error;
        }

        if (liveMode) {
            stopLive();
        }
    };

    r.onend = () => {
        if (liveMode && !translating && !window.speechSynthesis.speaking) {
            setTimeout(startRecognitionOnly, 150);
        }
    };

    return r;
}

function startRecognitionOnly() {
    if (!liveMode) return;

    if (!recognition) {
        recognition = createRecognition();
    }

    if (!recognition) return;

    try {
        recognition.start();
    } catch (error) {
        // Recognition can throw if start() is called twice.
    }
}

function stopRecognitionOnly() {
    try {
        recognition?.stop();
    } catch (error) {
        // Ignore repeated stop calls.
    }
}

function startLive() {
    if (!recognition) {
        recognition = createRecognition();
    }

    if (!recognition) return;

    liveMode = true;
    liveBtn.textContent = "■ Stop Live";
    liveStatus.textContent = "LIVE";
    liveStatus.classList.add("on");

    voiceMessage.textContent =
        "Live mode started. Speak one sentence at a time.";

    startRecognitionOnly();
}

function stopLive() {
    liveMode = false;
    translating = false;

    stopRecognitionOnly();

    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    liveBtn.textContent = "● Start Live";
    liveStatus.textContent = "OFF";
    liveStatus.classList.remove("on");
    voiceMessage.textContent = "Live translation stopped.";
}

liveBtn.addEventListener("click", () => {
    if (liveMode) {
        stopLive();
    } else {
        startLive();
    }
});

// Load voices once the browser exposes them.
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

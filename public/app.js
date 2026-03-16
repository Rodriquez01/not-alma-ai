const apiState = document.getElementById("apiState");

const topicInput = document.getElementById("topicInput");
const levelSelect = document.getElementById("levelSelect");
const toneSelect = document.getElementById("toneSelect");
const lengthSelect = document.getElementById("lengthSelect");

const generateTopicBtn = document.getElementById("generateTopicBtn");
const summarizeBtn = document.getElementById("summarizeBtn");
const quizBtn = document.getElementById("quizBtn");
const flashcardsBtn = document.getElementById("flashcardsBtn");
const clearMainTextBtn = document.getElementById("clearMainTextBtn");
const copyMainTextBtn = document.getElementById("copyMainTextBtn");

const mainText = document.getElementById("mainText");
const summaryOutput = document.getElementById("summaryOutput");
const quizOutput = document.getElementById("quizOutput");
const flashcardsOutput = document.getElementById("flashcardsOutput");

const voiceSelect = document.getElementById("voiceSelect");
const rateRange = document.getElementById("rateRange");
const pitchRange = document.getElementById("pitchRange");
const volumeRange = document.getElementById("volumeRange");
const handwritingSpeed = document.getElementById("handwritingSpeed");
const extraPause = document.getElementById("extraPause");
const sentencePause = document.getElementById("sentencePause");
const chunkSize = document.getElementById("chunkSize");

const rateValue = document.getElementById("rateValue");
const pitchValue = document.getElementById("pitchValue");
const volumeValue = document.getElementById("volumeValue");

const testVoiceBtn = document.getElementById("testVoiceBtn");
const calcBtn = document.getElementById("calcBtn");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const stopBtn = document.getElementById("stopBtn");

const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const currentChunk = document.getElementById("currentChunk");

const wordCount = document.getElementById("wordCount");
const charCount = document.getElementById("charCount");
const writeTime = document.getElementById("writeTime");
const speakTime = document.getElementById("speakTime");

const notesArea = document.getElementById("notesArea");
const saveNotesBtn = document.getElementById("saveNotesBtn");
const downloadNotesBtn = document.getElementById("downloadNotesBtn");
const copyNotesBtn = document.getElementById("copyNotesBtn");
const loadNotesBtn = document.getElementById("loadNotesBtn");
const clearNotesBtn = document.getElementById("clearNotesBtn");

const loadDemoBtn = document.getElementById("loadDemoBtn");
const saveAllBtn = document.getElementById("saveAllBtn");

const presetButtons = document.querySelectorAll(".preset-btn");

let voices = [];
let readingChunks = [];
let currentIndex = 0;
let isStopped = true;
let isPaused = false;
let activeTimeout = null;

function setLoading(button, state, text = "Yükleniyor...") {
  if (!button) return;

  if (state) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

function updateSliderTexts() {
  rateValue.textContent = `${Number(rateRange.value).toFixed(2)}x`;
  pitchValue.textContent = Number(pitchRange.value).toFixed(2);
  volumeValue.textContent = Number(volumeRange.value).toFixed(2);
}

function populateVoices() {
  voices = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";

  if (!voices.length) {
    const option = document.createElement("option");
    option.textContent = "Ses bulunamadı";
    option.value = "";
    voiceSelect.appendChild(option);
    return;
  }

  const trVoices = voices.filter((v) => v.lang.toLowerCase().includes("tr"));
  const useVoices = trVoices.length ? trVoices : voices;

  useVoices.forEach((voice, i) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (i === 0) option.selected = true;
    voiceSelect.appendChild(option);
  });
}

function getSelectedVoice() {
  return voices.find((v) => v.name === voiceSelect.value) || null;
}

function splitTextIntoChunks(text, wordsPerChunk = 12) {
  if (!text.trim()) return [];

  const normalized = text.replace(/\n+/g, " ").trim();
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = [];

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);

    if (words.length <= wordsPerChunk) {
      chunks.push(sentence);
    } else {
      for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
      }
    }
  }

  return chunks;
}

function getTextStats(text) {
  const clean = text.trim();
  return {
    words: clean ? clean.split(/\s+/).length : 0,
    chars: clean.length
  };
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 sn";
  if (seconds < 60) return `${Math.round(seconds)} sn`;

  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min} dk ${sec} sn`;
}

function estimateTimes() {
  const text = mainText.value.trim();
  const { words, chars } = getTextStats(text);

  wordCount.textContent = words;
  charCount.textContent = chars;

  const writingCharsPerMinute = Math.max(
    60,
    Number(handwritingSpeed.value) || 350
  );
  const writeSeconds = chars / (writingCharsPerMinute / 60);

  const rate = Number(rateRange.value) || 1;
  const baseWpm = 145 * rate;
  const speechSeconds = words / (baseWpm / 60);

  const chunks = splitTextIntoChunks(text, Number(chunkSize.value) || 12);
  const pauseSeconds = chunks.reduce((acc, part) => {
    const sentenceEnds = (part.match(/[.!?]/g) || []).length;
    return (
      acc +
      (Number(extraPause.value) || 0) / 1000 +
      sentenceEnds * ((Number(sentencePause.value) || 0) / 1000)
    );
  }, 0);

  writeTime.textContent = formatDuration(writeSeconds);
  speakTime.textContent = formatDuration(speechSeconds + pauseSeconds);
}

function getDynamicPauseMs(chunk) {
  const chars = chunk.length;
  const writingCharsPerMinute = Math.max(
    60,
    Number(handwritingSpeed.value) || 350
  );
  const msPerChar = 60000 / writingCharsPerMinute;
  const writeMs = chars * msPerChar;
  const baseExtra = Number(extraPause.value) || 0;
  const sentenceExtra = /[.!?]$/.test(chunk.trim())
    ? Number(sentencePause.value) || 0
    : 0;

  return Math.round(writeMs + baseExtra + sentenceExtra);
}

function updateProgress() {
  progressText.textContent = `${Math.min(currentIndex, readingChunks.length)} / ${readingChunks.length}`;
  const percent = readingChunks.length
    ? (currentIndex / readingChunks.length) * 100
    : 0;
  progressFill.style.width = `${percent}%`;
}

function stopPlayback() {
  isStopped = true;
  isPaused = false;
  window.speechSynthesis.cancel();

  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
}

function speakChunk(chunk, onEnd) {
  const utterance = new SpeechSynthesisUtterance(chunk);
  utterance.voice = getSelectedVoice();
  utterance.lang = utterance.voice?.lang || "tr-TR";
  utterance.rate = Number(rateRange.value) || 1;
  utterance.pitch = Number(pitchRange.value) || 1;
  utterance.volume = Number(volumeRange.value) || 1;

  utterance.onend = onEnd;
  utterance.onerror = onEnd;

  window.speechSynthesis.speak(utterance);
}

function playSequence() {
  if (isStopped || isPaused) return;

  if (currentIndex >= readingChunks.length) {
    currentChunk.textContent = "Okuma tamamlandı.";
    updateProgress();
    return;
  }

  const chunk = readingChunks[currentIndex];
  currentChunk.textContent = chunk;

  speakChunk(chunk, () => {
    if (isStopped || isPaused) return;

    const pauseMs = getDynamicPauseMs(chunk);
    activeTimeout = setTimeout(() => {
      currentIndex += 1;
      updateProgress();
      playSequence();
    }, pauseMs);
  });
}

async function fetchJSON(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const rawText = await response.text();

    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseError) {
      throw new Error(
        `Sunucudan JSON yerine farklı cevap geldi. Status: ${response.status}`
      );
    }

    if (!response.ok || !data.ok) {
      const serverMessage =
        data?.error ||
        data?.details ||
        `Sunucu hatası. Status: ${response.status}`;
      throw new Error(serverMessage);
    }

    return data;
  } catch (error) {
    console.error("fetchJSON hata:", error);
    throw error;
  }
}

async function loadConfig() {
  try {
    const data = await fetchJSON("/api/config");
    if (data.hasApiKey) {
      apiState.textContent = `Hazır • ${data.model}`;
    } else {
      apiState.textContent = "API key eksik";
    }
  } catch (error) {
    console.error("loadConfig hata:", error);
    apiState.textContent = "Sunucu hatası";
  }
}

function loadDemoText() {
  mainText.value = `Bugün fotosentez konusunu anlatıyoruz. Fotosentez, bitkilerin ışık enerjisini kullanarak besin üretme olayıdır. Bu olay genellikle yapraklarda gerçekleşir. Çünkü yapraklarda kloroplast adı verilen yapılar bulunur. Kloroplastların içinde klorofil vardır. Klorofil, güneş ışığını tutmaya yarar.

Bitkiler fotosentez yaparken havadan karbondioksit alır. Topraktan ise su alırlar. Güneş ışığı yardımıyla bu maddeleri birleştirerek glikoz üretirler. Glikoz, bitkinin besinidir. Aynı zamanda oksijen de oluşur ve dışarı verilir.

Fotosentezin gerçekleşebilmesi için ışık, su, karbondioksit ve klorofil gerekir. Bu şartlardan biri eksik olursa fotosentez düzgün gerçekleşmez.

Kısaca, bitkiler su ve karbondioksiti kullanır. Güneş ışığı yardımıyla besin üretir. Bu olayın adı fotosentezdir.`;

  estimateTimes();
}

function applyPreset(type) {
  if (type === "fast") {
    handwritingSpeed.value = 350;
    extraPause.value = 200;
    sentencePause.value = 300;
    chunkSize.value = 12;
  } else if (type === "balanced") {
    handwritingSpeed.value = 260;
    extraPause.value = 450;
    sentencePause.value = 700;
    chunkSize.value = 10;
  } else {
    handwritingSpeed.value = 180;
    extraPause.value = 850;
    sentencePause.value = 1200;
    chunkSize.value = 8;
  }

  estimateTimes();
}

async function generateTopic() {
  const topic = topicInput.value.trim();

  if (!topic) {
    alert("Önce konu gir.");
    return;
  }

  setLoading(generateTopicBtn, true, "Üretiliyor...");

  try {
    const data = await fetchJSON("/api/generate-topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        topic,
        level: levelSelect.value,
        tone: toneSelect.value,
        length: lengthSelect.value
      })
    });

    mainText.value = data.text || "";
    estimateTimes();
  } catch (error) {
    console.error("generateTopic hata:", error);
    alert("Konu anlatımı üretilemedi: " + error.message);
  } finally {
    setLoading(generateTopicBtn, false);
  }
}

async function summarizeText() {
  const text = mainText.value.trim();

  if (!text) {
    alert("Önce ana metin gir.");
    return;
  }

  setLoading(summarizeBtn, true, "Özetleniyor...");

  try {
    const data = await fetchJSON("/api/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        mode: "kısa"
      })
    });

    summaryOutput.value = data.summary || "";
  } catch (error) {
    console.error("summarize hata:", error);
    alert("Özet üretilemedi: " + error.message);
  } finally {
    setLoading(summarizeBtn, false);
  }
}

async function generateQuiz() {
  const text = mainText.value.trim();

  if (!text) {
    alert("Önce ana metin gir.");
    return;
  }

  setLoading(quizBtn, true, "Hazırlanıyor...");

  try {
    const data = await fetchJSON("/api/quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        count: 5
      })
    });

    quizOutput.value = data.quiz || "";
  } catch (error) {
    console.error("quiz hata:", error);
    alert("Quiz üretilemedi: " + error.message);
  } finally {
    setLoading(quizBtn, false);
  }
}

async function generateFlashcards() {
  const text = mainText.value.trim();

  if (!text) {
    alert("Önce ana metin gir.");
    return;
  }

  setLoading(flashcardsBtn, true, "Hazırlanıyor...");

  try {
    const data = await fetchJSON("/api/flashcards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        count: 6
      })
    });

    flashcardsOutput.value = data.flashcards || "";
  } catch (error) {
    console.error("flashcards hata:", error);
    alert("Flashcard üretilemedi: " + error.message);
  } finally {
    setLoading(flashcardsBtn, false);
  }
}

function saveNotes() {
  localStorage.setItem("hizlinot_notes", notesArea.value);
  alert("Notlar kaydedildi.");
}

function loadNotes() {
  const saved = localStorage.getItem("hizlinot_notes") || "";
  notesArea.value = saved;
  alert("Kayıtlı notlar yüklendi.");
}

function saveAll() {
  const payload = {
    topic: topicInput.value,
    mainText: mainText.value,
    summary: summaryOutput.value,
    quiz: quizOutput.value,
    flashcards: flashcardsOutput.value,
    notes: notesArea.value,
    level: levelSelect.value,
    tone: toneSelect.value,
    length: lengthSelect.value
  };

  localStorage.setItem("hizlinot_workspace", JSON.stringify(payload));
  alert("Çalışma alanı kaydedildi.");
}

function loadAll() {
  const raw = localStorage.getItem("hizlinot_workspace");
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    topicInput.value = data.topic || "";
    mainText.value = data.mainText || "";
    summaryOutput.value = data.summary || "";
    quizOutput.value = data.quiz || "";
    flashcardsOutput.value = data.flashcards || "";
    notesArea.value = data.notes || "";
    if (data.level) levelSelect.value = data.level;
    if (data.tone) toneSelect.value = data.tone;
    if (data.length) lengthSelect.value = data.length;
    estimateTimes();
  } catch (error) {
    console.error("loadAll hata:", error);
  }
}

function downloadText(filename, content) {
  if (!content.trim()) {
    alert("İndirilecek içerik yok.");
    return;
  }

  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

rateRange.addEventListener("input", updateSliderTexts);
pitchRange.addEventListener("input", updateSliderTexts);
volumeRange.addEventListener("input", updateSliderTexts);

mainText.addEventListener("input", estimateTimes);
calcBtn.addEventListener("click", estimateTimes);

generateTopicBtn.addEventListener("click", generateTopic);
summarizeBtn.addEventListener("click", summarizeText);
quizBtn.addEventListener("click", generateQuiz);
flashcardsBtn.addEventListener("click", generateFlashcards);

clearMainTextBtn.addEventListener("click", () => {
  mainText.value = "";
  estimateTimes();
});

copyMainTextBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(mainText.value);
    alert("Metin kopyalandı.");
  } catch (error) {
    console.error("copyMainText hata:", error);
    alert("Kopyalanamadı.");
  }
});

testVoiceBtn.addEventListener("click", () => {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(
    "Merhaba, ben HızlıNot Pro. Yazma hızına göre bekleyerek okuyorum."
  );

  utterance.voice = getSelectedVoice();
  utterance.lang = utterance.voice?.lang || "tr-TR";
  utterance.rate = Number(rateRange.value) || 1;
  utterance.pitch = Number(pitchRange.value) || 1;
  utterance.volume = Number(volumeRange.value) || 1;

  window.speechSynthesis.speak(utterance);
});

startBtn.addEventListener("click", () => {
  const text = mainText.value.trim();

  if (!text) {
    alert("Önce metin gir.");
    return;
  }

  stopPlayback();
  readingChunks = splitTextIntoChunks(text, Number(chunkSize.value) || 12);
  currentIndex = 0;
  isStopped = false;
  isPaused = false;

  updateProgress();
  estimateTimes();
  playSequence();
});

pauseBtn.addEventListener("click", () => {
  if (isStopped) return;

  isPaused = true;
  window.speechSynthesis.pause();

  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
});

resumeBtn.addEventListener("click", () => {
  if (isStopped) return;

  if (window.speechSynthesis.paused) {
    isPaused = false;
    window.speechSynthesis.resume();
    return;
  }

  if (isPaused) {
    isPaused = false;
    playSequence();
  }
});

stopBtn.addEventListener("click", () => {
  stopPlayback();
  currentChunk.textContent = "Henüz başlatılmadı.";
  progressText.textContent = "0 / 0";
  progressFill.style.width = "0%";
});

saveNotesBtn.addEventListener("click", saveNotes);
loadNotesBtn.addEventListener("click", loadNotes);

downloadNotesBtn.addEventListener("click", () => {
  downloadText("notlarim.txt", notesArea.value);
});

copyNotesBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(notesArea.value);
    alert("Notlar kopyalandı.");
  } catch (error) {
    console.error("copyNotes hata:", error);
    alert("Kopyalama başarısız.");
  }
});

clearNotesBtn.addEventListener("click", () => {
  if (confirm("Notları silmek istiyor musun?")) {
    notesArea.value = "";
  }
});

loadDemoBtn.addEventListener("click", loadDemoText);
saveAllBtn.addEventListener("click", saveAll);

presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    applyPreset(btn.dataset.preset);
  });
});

populateVoices();
if (window.speechSynthesis.onvoiceschanged !== undefined) {
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

updateSliderTexts();
loadConfig();
loadAll();
estimateTimes();
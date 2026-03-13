const mode = document.getElementById("mode");
const topicArea = document.getElementById("topicArea");
const topicInput = document.getElementById("topicInput");
const generateBtn = document.getElementById("generateBtn");
const apiStatus = document.getElementById("apiStatus");

const inputText = document.getElementById("inputText");
const notesArea = document.getElementById("notesArea");

const voiceSelect = document.getElementById("voiceSelect");
const rateRange = document.getElementById("rateRange");
const pitchRange = document.getElementById("pitchRange");
const volumeRange = document.getElementById("volumeRange");
const handwritingSpeed = document.getElementById("handwritingSpeed");
const extraPause = document.getElementById("extraPause");
const chunkSize = document.getElementById("chunkSize");
const sentencePause = document.getElementById("sentencePause");

const rateValue = document.getElementById("rateValue");
const pitchValue = document.getElementById("pitchValue");
const volumeValue = document.getElementById("volumeValue");

const testVoiceBtn = document.getElementById("testVoiceBtn");
const calcBtn = document.getElementById("calcBtn");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const stopBtn = document.getElementById("stopBtn");

const wordCount = document.getElementById("wordCount");
const charCount = document.getElementById("charCount");
const writeTime = document.getElementById("writeTime");
const speakTime = document.getElementById("speakTime");

const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const currentChunk = document.getElementById("currentChunk");

const downloadNotesBtn = document.getElementById("downloadNotesBtn");
const clearNotesBtn = document.getElementById("clearNotesBtn");
const copyNotesBtn = document.getElementById("copyNotesBtn");

let voices = [];
let readingChunks = [];
let currentIndex = 0;
let isPaused = false;
let isStopped = true;
let timeoutRef = null;

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
    option.value = "";
    option.textContent = "Tarayıcı sesleri yüklenemedi";
    voiceSelect.appendChild(option);
    return;
  }

  const trVoices = voices.filter(v => v.lang.toLowerCase().includes("tr"));
  const list = trVoices.length ? trVoices : voices;

  list.forEach((voice, index) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (index === 0) option.selected = true;
    voiceSelect.appendChild(option);
  });
}

function getSelectedVoice() {
  return voices.find(v => v.name === voiceSelect.value) || null;
}

function getTextStats(text) {
  const cleanText = text.trim();
  const words = cleanText ? cleanText.split(/\s+/).length : 0;
  const chars = cleanText.length;
  return { words, chars };
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 sn";
  if (seconds < 60) return `${Math.round(seconds)} sn`;

  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min} dk ${sec} sn`;
}

function splitTextIntoChunks(text, wordsPerChunk = 10) {
  if (!text.trim()) return [];

  const normalized = text.replace(/\n+/g, " ").trim();
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
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

function estimateTimes() {
  const text = inputText.value.trim();
  const { words, chars } = getTextStats(text);

  wordCount.textContent = words;
  charCount.textContent = chars;

  const writingCharsPerMinute = Math.max(60, Number(handwritingSpeed.value) || 220);
  const estimatedWriteSeconds = chars / (writingCharsPerMinute / 60);

  const avgWordsPerMinuteAtRate1 = 145;
  const currentRate = Number(rateRange.value) || 1;
  const speechWordsPerMinute = avgWordsPerMinuteAtRate1 * currentRate;
  const estimatedSpeechSecondsBase = words / (speechWordsPerMinute / 60);

  const chunks = splitTextIntoChunks(text, Number(chunkSize.value) || 10);
  const estimatedPauses = chunks.reduce((acc, part) => {
    const sentenceEndCount = (part.match(/[.!?]/g) || []).length;
    return (
      acc +
      (Number(extraPause.value) || 0) / 1000 +
      sentenceEndCount * ((Number(sentencePause.value) || 0) / 1000)
    );
  }, 0);

  writeTime.textContent = formatDuration(estimatedWriteSeconds);
  speakTime.textContent = formatDuration(estimatedSpeechSecondsBase + estimatedPauses);
}

function getDynamicPauseMs(chunk) {
  const chars = chunk.length;
  const writingCharsPerMinute = Math.max(60, Number(handwritingSpeed.value) || 220);
  const msPerChar = 60000 / writingCharsPerMinute;
  const writeMs = chars * msPerChar;

  const baseExtra = Number(extraPause.value) || 0;
  const sentenceExtra = /[.!?]$/.test(chunk.trim())
    ? Number(sentencePause.value) || 0
    : 0;

  return Math.round(writeMs + baseExtra + sentenceExtra);
}

function speakChunk(chunk, onEnd) {
  if (!chunk) return;

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

function updateProgress() {
  progressText.textContent = `${Math.min(currentIndex, readingChunks.length)} / ${readingChunks.length}`;
  const percent = readingChunks.length ? (currentIndex / readingChunks.length) * 100 : 0;
  progressFill.style.width = `${percent}%`;
}

function resetPlaybackUI() {
  currentChunk.textContent = "Henüz başlatılmadı.";
  progressText.textContent = "0 / 0";
  progressFill.style.width = "0%";
}

function stopPlayback() {
  isStopped = true;
  isPaused = false;
  window.speechSynthesis.cancel();

  if (timeoutRef) {
    clearTimeout(timeoutRef);
    timeoutRef = null;
  }
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

    timeoutRef = setTimeout(() => {
      currentIndex += 1;
      updateProgress();
      playSequence();
    }, pauseMs);
  });
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();

    if (!data.ok) {
      apiStatus.textContent = "API durumu alınamadı.";
      return;
    }

    if (data.hasApiKey) {
      apiStatus.textContent = `API hazır. Model: ${data.model}`;
    } else {
      apiStatus.textContent = "API key ayarlı değil. .env dosyasını doldurman lazım.";
    }
  } catch (error) {
    apiStatus.textContent = "Sunucuya bağlanılamadı.";
  }
}

async function generateTopicText() {
  const topic = topicInput.value.trim();

  if (!topic) {
    alert("Önce bir konu gir.");
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "Üretiliyor...";

  try {
    const response = await fetch("/api/generate-topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ topic })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data?.error || "Metin üretilemedi.");
    }

    inputText.value = data.text || "";
    estimateTimes();
    alert("Konu anlatım metni oluşturuldu.");
  } catch (error) {
    console.error(error);
    alert("Metin üretirken hata oldu: " + error.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Konuyu Anlatım Metnine Dönüştür";
  }
}

mode.addEventListener("change", () => {
  topicArea.classList.toggle("hidden", mode.value !== "topic");
});

rateRange.addEventListener("input", updateSliderTexts);
pitchRange.addEventListener("input", updateSliderTexts);
volumeRange.addEventListener("input", updateSliderTexts);

testVoiceBtn.addEventListener("click", () => {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(
    "Merhaba, ben senin not alma asistanınım. Yazma hızına göre bekleyerek konuşuyorum."
  );
  utterance.voice = getSelectedVoice();
  utterance.lang = utterance.voice?.lang || "tr-TR";
  utterance.rate = Number(rateRange.value) || 1;
  utterance.pitch = Number(pitchRange.value) || 1;
  utterance.volume = Number(volumeRange.value) || 1;

  window.speechSynthesis.speak(utterance);
});

calcBtn.addEventListener("click", estimateTimes);
inputText.addEventListener("input", estimateTimes);
generateBtn.addEventListener("click", generateTopicText);

startBtn.addEventListener("click", () => {
  const text = inputText.value.trim();

  if (!text) {
    alert("Önce okunacak metni gir.");
    return;
  }

  stopPlayback();

  readingChunks = splitTextIntoChunks(text, Number(chunkSize.value) || 10);
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

  if (timeoutRef) {
    clearTimeout(timeoutRef);
    timeoutRef = null;
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
  resetPlaybackUI();
});

downloadNotesBtn.addEventListener("click", () => {
  const content = notesArea.value.trim();

  if (!content) {
    alert("İndirilecek not yok.");
    return;
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "notlarim.txt";
  a.click();

  URL.revokeObjectURL(url);
});

clearNotesBtn.addEventListener("click", () => {
  if (confirm("Notları temizlemek istiyor musun?")) {
    notesArea.value = "";
  }
});

copyNotesBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(notesArea.value);
    alert("Notlar kopyalandı.");
  } catch (error) {
    console.error(error);
    alert("Kopyalama başarısız oldu.");
  }
});

populateVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = populateVoices;
}

updateSliderTexts();
estimateTimes();
checkApiStatus();
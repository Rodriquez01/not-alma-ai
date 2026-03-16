<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Akıllı Not Alma Asistanı</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div>
        <h1>Akıllı Not Alma Asistanı</h1>
        <p>Metni öğretmen anlatıyormuş gibi okut, yazma hızına göre duraksat, rahat not al.</p>
      </div>
      <div class="badge-row">
        <span class="badge" id="apiBadge">AI bağlantısı kontrol ediliyor...</span>
      </div>
    </header>

    <main class="grid">
      <section class="card">
        <h2>1) Giriş</h2>

        <label for="mode">Çalışma Modu</label>
        <select id="mode">
          <option value="text">Hazır Metni Oku</option>
          <option value="topic">Konudan Anlatım Üret</option>
        </select>

        <div id="topicArea" class="hidden">
          <label for="topicInput">Konu Başlığı</label>
          <input
            id="topicInput"
            type="text"
            placeholder="Örn: Mitoz bölünme, Kurtuluş Savaşı, Fonksiyonlar"
          />
          <button id="generateBtn" class="primary spaced-top">Konuyu Anlatım Metnine Dönüştür</button>
          <p class="info" id="apiStatus">API durumu kontrol ediliyor...</p>
        </div>

        <label for="inputText">Okunacak Metin</label>
        <textarea
          id="inputText"
          rows="12"
          placeholder="Buraya metin yapıştır. Uygulama bunu öğretmen gibi anlatır ve yazma hızına göre beklemeler ekler."
        ></textarea>
      </section>

      <aside class="card helper-card">
        <h2>⚡ Önerilen Ayarlar</h2>
        <p>Hızlı ve rahat kullanım için başlangıç değerleri:</p>
        <ul>
          <li><strong>Yazma Hızı:</strong> 350</li>
          <li><strong>Ek Bekleme:</strong> 200</li>
          <li><strong>Cümle Sonu Duraklama:</strong> 300</li>
          <li><strong>Parça Uzunluğu:</strong> 8-10 kelime</li>
        </ul>
        <p class="muted">Yazma hızını yükseltirsen okuma akışı da daha tempolu olur.</p>
      </aside>

      <section class="card">
        <h2>2) Okuma ve Yazma Ayarları</h2>

        <div class="two-col">
          <div>
            <label for="voiceSelect">Ses</label>
            <select id="voiceSelect"></select>
          </div>

          <div>
            <label for="rateRange">Konuşma Hızı</label>
            <input id="rateRange" type="range" min="0.6" max="1.4" step="0.05" value="0.95" />
            <span id="rateValue">0.95x</span>
          </div>
        </div>

        <div class="two-col">
          <div>
            <label for="pitchRange">Ses Tonu</label>
            <input id="pitchRange" type="range" min="0.8" max="1.3" step="0.05" value="1" />
            <span id="pitchValue">1.00</span>
          </div>

          <div>
            <label for="volumeRange">Ses Seviyesi</label>
            <input id="volumeRange" type="range" min="0.1" max="1" step="0.05" value="1" />
            <span id="volumeValue">1.00</span>
          </div>
        </div>

        <div class="two-col">
          <div>
            <label for="handwritingSpeed">Yazma Hızı (karakter/dakika)</label>
            <input id="handwritingSpeed" type="number" min="60" max="1200" value="350" />
          </div>

          <div>
            <label for="extraPause">Ek Bekleme (ms)</label>
            <input id="extraPause" type="number" min="0" max="5000" value="200" />
          </div>
        </div>

        <div class="two-col">
          <div>
            <label for="chunkSize">Parça Uzunluğu (kelime)</label>
            <input id="chunkSize" type="number" min="4" max="40" value="8" />
          </div>

          <div>
            <label for="sentencePause">Cümle Sonu Ek Duraklama (ms)</label>
            <input id="sentencePause" type="number" min="0" max="6000" value="300" />
          </div>
        </div>

        <div class="two-col">
          <button id="testVoiceBtn">Sesi Test Et</button>
          <button id="calcBtn">Tahmini Süreyi Hesapla</button>
        </div>

        <div class="stats">
          <p><strong>Kelime:</strong> <span id="wordCount">0</span></p>
          <p><strong>Karakter:</strong> <span id="charCount">0</span></p>
          <p><strong>Tahmini Yazma Süresi:</strong> <span id="writeTime">0 sn</span></p>
          <p><strong>Tahmini Okutma Süresi:</strong> <span id="speakTime">0 sn</span></p>
        </div>
      </section>

      <section class="card full">
        <h2>3) Oynatıcı</h2>

        <div class="controls">
          <button id="startBtn" class="primary">Başlat</button>
          <button id="pauseBtn">Duraklat</button>
          <button id="resumeBtn">Devam Et</button>
          <button id="stopBtn" class="danger">Durdur</button>
        </div>

        <div class="progress-box">
          <div class="progress-header">
            <span>İlerleme</span>
            <span id="progressText">0 / 0</span>
          </div>
          <div class="progress-bar">
            <div id="progressFill"></div>
          </div>
        </div>

        <div class="current-chunk">
          <h3>Şu An Okunan Parça</h3>
          <p id="currentChunk">Henüz başlatılmadı.</p>
        </div>
      </section>

      <section class="card full">
        <h2>4) Not Alanı</h2>
        <textarea id="notesArea" rows="12" placeholder="Buraya notlarını yaz..."></textarea>

        <div class="controls">
          <button id="downloadNotesBtn">Notları İndir (.txt)</button>
          <button id="clearNotesBtn">Notları Temizle</button>
          <button id="copyNotesBtn">Notları Kopyala</button>
        </div>
      </section>
    </main>
  </div>

  <script src="app.js"></script>
</body>
</html>

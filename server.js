require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
const OPENAI_API_URL = (process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions').trim();

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
const GEMINI_API_URL = (process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models').trim();

function getActiveProvider() {
  if (GEMINI_API_KEY) {
    return { provider: 'gemini', model: GEMINI_MODEL };
  }

  if (OPENAI_API_KEY) {
    return { provider: 'openai', model: OPENAI_MODEL };
  }

  return { provider: null, model: null };
}

function buildTeachingPrompt(topic) {
  return [
    `Konu: ${topic}`,
    '',
    'Bu konuyu sınıfta anlatan iyi bir öğretmen gibi Türkçe açıkla.',
    'Metin öğrencinin not almasını kolaylaştırmalı.',
    'Cümleler kısa ve anlaşılır olsun.',
    'Doğal ders anlatımı tonunda yaz.',
    'Önce kısa giriş yap.',
    'Sonra konuyu düzenli sırayla anlat.',
    'Gerekli yerlerde kısa tekrar cümleleri ekle.',
    'Madde işareti kullanma.',
    'Sonda çok kısa bir özet ver.'
  ].join('\n');
}

function parseOpenAIText(payload) {
  return payload?.choices?.[0]?.message?.content?.trim() || '';
}

function parseGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(part => part?.text || '').join('').trim();
}

async function generateWithOpenAI(topic) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Sen öğrenciler için öğretmen anlatımı gibi sade, akıcı ve not alınabilir ders metni hazırlayan bir asistansın.'
        },
        {
          role: 'user',
          content: buildTeachingPrompt(topic)
        }
      ],
      temperature: 0.7
    })
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI hata verdi: ${response.status} ${rawText}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error('OpenAI cevabı JSON değil.');
  }

  const text = parseOpenAIText(data);
  if (!text) {
    throw new Error('OpenAI metin döndürmedi.');
  }

  return text;
}

async function generateWithGemini(topic) {
  const url = `${GEMINI_API_URL}/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 900
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildTeachingPrompt(topic)
            }
          ]
        }
      ]
    })
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini hata verdi: ${response.status} ${rawText}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error('Gemini cevabı JSON değil.');
  }

  const text = parseGeminiText(data);
  if (!text) {
    throw new Error('Gemini metin döndürmedi.');
  }

  return text;
}

function getPublicConfig() {
  const active = getActiveProvider();
  return {
    ok: true,
    hasApiKey: Boolean(active.provider),
    provider: active.provider,
    model: active.model
  };
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (_req, res) => {
  res.json(getPublicConfig());
});

app.post('/api/generate-topic', async (req, res) => {
  try {
    const topic = String(req.body?.topic || '').trim();

    if (!topic) {
      return res.status(400).json({ ok: false, error: 'Konu boş olamaz.' });
    }

    const active = getActiveProvider();
    if (!active.provider) {
      return res.status(500).json({
        ok: false,
        error: 'Sunucuda AI anahtarı ayarlı değil. OPENAI_API_KEY veya GEMINI_API_KEY ekle.'
      });
    }

    const text = active.provider === 'gemini'
      ? await generateWithGemini(topic)
      : await generateWithOpenAI(topic);

    return res.json({
      ok: true,
      provider: active.provider,
      model: active.model,
      text
    });
  } catch (error) {
    console.error('generate-topic error:', error);

    const message = String(error?.message || 'Bilinmeyen hata');
    const lowered = message.toLowerCase();

    let safeError = 'Sunucu hatası oluştu.';
    if (lowered.includes('401') || lowered.includes('api key') || lowered.includes('unauthorized')) {
      safeError = 'API anahtarı geçersiz ya da yanlış servis için kullanılıyor.';
    } else if (lowered.includes('429')) {
      safeError = 'API kullanım limiti aşıldı ya da bakiye yetersiz.';
    } else if (lowered.includes('model')) {
      safeError = 'Seçili model bu servis için uygun değil.';
    }

    return res.status(500).json({
      ok: false,
      error: safeError,
      details: message
    });
  }
});

app.listen(PORT, () => {
  const active = getActiveProvider();
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
  console.log(`Aktif sağlayıcı: ${active.provider || 'yok'} ${active.model || ''}`.trim());
});

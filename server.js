require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function getActiveProvider() {
  if (GEMINI_API_KEY) {
    return {
      provider: "gemini",
      model: GEMINI_MODEL,
    };
  }

  if (OPENAI_API_KEY) {
    return {
      provider: "openai",
      model: OPENAI_MODEL,
    };
  }

  return {
    provider: "none",
    model: null,
  };
}

app.get("/api/config", (req, res) => {
  const active = getActiveProvider();

  res.json({
    ok: true,
    hasApiKey: active.provider !== "none",
    provider: active.provider,
    model: active.model,
  });
});

function buildTopicPrompt(topic) {
  return `
Aşağıdaki konuyu, sınıfta öğretmen anlatıyormuş gibi açıkla.

Kurallar:
- Türkçe yaz.
- Sade ve anlaşılır ol.
- Öğrencinin not almasını kolaylaştır.
- Cümleler çok uzun olmasın.
- Gereksiz süsleme yapma.
- Önce kısa bir giriş yap.
- Sonra düzenli bir konu anlatımı oluştur.
- Önemli yerleri kısa kısa vurgula.
- Madde işareti kullanma.
- Doğal bir öğretmen anlatımı gibi yaz.
- Sonunda çok kısa bir özet ekle.

Konu: ${String(topic).trim()}
`.trim();
}

async function generateWithOpenAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Sen öğrenciler için öğretmen anlatımı şeklinde sade ders metni hazırlayan bir asistansın.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let details = rawText;
    try {
      const parsed = JSON.parse(rawText);
      details = parsed?.error?.message || rawText;
    } catch (_) {}
    throw new Error(`OpenAI hata verdi: ${response.status} - ${details}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error("OpenAI cevabı JSON değil.");
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI cevap içeriği boş döndü.");
  }

  return content;
}

async function generateWithGemini(prompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Sen öğrenciler için öğretmen anlatımı şeklinde sade ders metni hazırlayan bir asistansın.\n\n${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let details = rawText;
    try {
      const parsed = JSON.parse(rawText);
      details = parsed?.error?.message || rawText;
    } catch (_) {}
    throw new Error(`Gemini hata verdi: ${response.status} - ${details}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error("Gemini cevabı JSON değil.");
  }

  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Gemini cevap içeriği boş döndü.");
  }

  return content;
}

app.post("/api/generate-topic", async (req, res) => {
  try {
    const { topic } = req.body || {};

    if (!topic || !String(topic).trim()) {
      return res.status(400).json({
        ok: false,
        error: "Konu boş olamaz.",
      });
    }

    const active = getActiveProvider();

    if (active.provider === "none") {
      return res.status(500).json({
        ok: false,
        error: "Sunucuda geçerli bir API anahtarı yok.",
      });
    }

    const prompt = buildTopicPrompt(topic);

    let text = "";

    if (active.provider === "gemini") {
      text = await generateWithGemini(prompt);
    } else if (active.provider === "openai") {
      text = await generateWithOpenAI(prompt);
    }

    return res.json({
      ok: true,
      text,
      provider: active.provider,
      model: active.model,
    });
  } catch (error) {
    console.error("generate-topic error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Sunucu hatası oluştu.",
    });
  }
});

app.listen(PORT, () => {
  const active = getActiveProvider();
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
  console.log(`Aktif servis: ${active.provider} / ${active.model || "yok"}`);
});

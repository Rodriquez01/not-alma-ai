require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const OPENAI_API_URL =
  process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(OPENAI_API_KEY),
    model: OPENAI_MODEL
  });
});

app.post("/api/generate-topic", async (req, res) => {
  try {
    const { topic } = req.body || {};

    if (!topic || !String(topic).trim()) {
      return res.status(400).json({
        ok: false,
        error: "Konu boş olamaz."
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Sunucuda OPENAI_API_KEY ayarlı değil."
      });
    }

    const prompt = `
Aşağıdaki konuyu, sınıfta öğretmen anlatıyormuş gibi açıkla.

Kurallar:
- Türkçe yaz.
- Sade ve anlaşılır ol.
- Öğrencinin not almasını kolaylaştır.
- Cümleler çok uzun olmasın.
- Gereksiz süsleme yapma.
- Önce kısa bir giriş yap.
- Sonra düzenli bir konu anlatımı oluştur.
- Önemli yerleri tekrar eden kısa vurgular ekle.
- Madde işareti kullanma, doğal ders anlatımı gibi yaz.
- Sonunda çok kısa bir özet ekle.

Konu: ${String(topic).trim()}
`;

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Sen öğrenciler için öğretmen anlatımı şeklinde sade ders metni hazırlayan bir asistansın."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    const rawText = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `API hata verdi: ${response.status}`,
        details: rawText
      });
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      return res.status(500).json({
        ok: false,
        error: "API cevabı JSON değil.",
        details: rawText
      });
    }

    const content =
      data?.choices?.[0]?.message?.content ||
      "Metin üretilemedi.";

    return res.json({
      ok: true,
      text: content
    });
  } catch (error) {
    console.error("generate-topic error:", error);
    return res.status(500).json({
      ok: false,
      error: "Sunucu hatası oluştu.",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});